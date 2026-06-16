// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

/**
 * E28-S1 characterization net — public blog LIST — ADAPTED to RSC in S2 (A88/A79).
 * The page flipped client→async Server Component: the SC fetches + SSRs the hero,
 * and the search box + filtered card grid + error/empty live in the `<BlogSearch>`
 * client island. The render harness adapts `render(<Page/>)` → `render(await
 * Page())` + mocks BOTH `next-intl/server` `getTranslations` (the SC hero) and
 * `next-intl` `useTranslations` (the island). The BEHAVIOURAL assertions —
 * error/empty/noResults, the 5-field search filter, de-CH date, 200-char excerpt,
 * category + content-language badges, `/public/blog/${id}` id-routing, unoptimized
 * image — are UNCHANGED.
 *
 * Principal A79 delta: the client loading-spinner test is removed (an RSC has no
 * client "loading" state for the initial fetch).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (_ns?: string) => (k: string) => k,
}));

vi.mock("next-intl", () => {
  const translators: Record<string, (k: string) => string> = {};
  return {
    useTranslations: (ns?: string) => {
      const key = ns ?? "_";
      if (!translators[key]) translators[key] = (k: string) => k;
      return translators[key];
    },
  };
});

import PublicBlogPage from "./page";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  tags: string[];
  publishedAt: string;
  imageUrl?: string;
  contentLanguage?: string;
};

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: "p1",
    title: "First Post",
    slug: "first-post",
    excerpt: "An excerpt",
    content: "Body content",
    author: "Alice",
    category: "News",
    tags: ["alpha"],
    publishedAt: "2026-07-01T10:00:00Z",
    ...overrides,
  };
}

function stubFetch(posts: Post[], ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => posts }) as unknown as Response)
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PublicBlogPage (E28-S1 characterization, RSC-adapted)", () => {
  it("fetches the public blog feed from /api/v1/blog/public", async () => {
    const fetchMock = vi.fn(
      async (_url?: unknown) =>
        ({ ok: true, json: async () => [] }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);
    render(await PublicBlogPage());
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/blog/public");
  });

  it("renders the error block with a retry reload button on fetch failure", async () => {
    stubFetch([], false);
    render(await PublicBlogPage());
    expect(screen.getByText("errorMessage")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
  });

  it("renders the empty copy (no search) when the feed is empty", async () => {
    stubFetch([]);
    render(await PublicBlogPage());
    expect(screen.getByText("empty")).toBeInTheDocument();
    expect(screen.queryByText("noResults")).toBeNull();
  });

  it("renders the noResults copy (search active) when the filter matches nothing", async () => {
    stubFetch([post({ title: "Visible" })]);
    render(await PublicBlogPage());
    expect(screen.getByText("Visible")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), {
      target: { value: "zzz-no-match" },
    });
    expect(screen.getByText("noResults")).toBeInTheDocument();
    expect(screen.queryByText("empty")).toBeNull();
  });

  it.each([
    ["title", "Needle Title", { title: "Needle Title" }],
    ["excerpt", "needle-excerpt", { excerpt: "needle-excerpt" }],
    ["author", "NeedleAuthor", { author: "NeedleAuthor" }],
    ["category", "NeedleCategory", { category: "NeedleCategory" }],
    ["tags", "needletag", { tags: ["needletag"] }],
  ])(
    "filters the list by %s (5-field client search)",
    async (_field, query, overrides) => {
      stubFetch([
        post({
          id: "match",
          title: "Match",
          excerpt: "m",
          author: "Mara",
          category: "M",
          tags: ["mt"],
          ...overrides,
        }),
        post({
          id: "other",
          title: "Other",
          excerpt: "x",
          author: "Bob",
          category: "Z",
          tags: ["q"],
        }),
      ]);
      render(await PublicBlogPage());
      expect(screen.getByText("Other")).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), {
        target: { value: query },
      });
      // The match card survived (no noResults) and the non-matching card is gone.
      expect(screen.queryByText("Other")).toBeNull();
      expect(screen.queryByText("noResults")).toBeNull();
    }
  );

  it("formats the published date with the de-CH long-date format", async () => {
    const iso = "2026-07-01T10:00:00Z";
    const expected = new Date(iso).toLocaleDateString("de-CH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    stubFetch([post({ publishedAt: iso })]);
    render(await PublicBlogPage());
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("truncates a present excerpt to 200 characters (no ellipsis)", async () => {
    const longExcerpt = "E".repeat(250);
    stubFetch([post({ excerpt: longExcerpt, content: "ignored" })]);
    render(await PublicBlogPage());
    expect(screen.getByText("E".repeat(200))).toBeInTheDocument();
    expect(screen.queryByText("E".repeat(250))).toBeNull();
  });

  it("falls back to content sliced to 200 chars + ellipsis when no excerpt", async () => {
    const longContent = "C".repeat(250);
    stubFetch([post({ excerpt: "", content: longContent })]);
    render(await PublicBlogPage());
    expect(screen.getByText("C".repeat(200) + "…")).toBeInTheDocument();
  });

  it("renders the category badge and the content-language badge only when set", async () => {
    stubFetch([post({ category: "Tech", contentLanguage: "de" })]);
    render(await PublicBlogPage());
    expect(screen.getByText("Tech")).toBeInTheDocument();
    // tLang identity → the raw language code is the rendered badge text.
    expect(screen.getByText("de")).toBeInTheDocument();
  });

  it("omits the content-language badge when contentLanguage is absent", async () => {
    stubFetch([post({ contentLanguage: undefined })]);
    render(await PublicBlogPage());
    expect(screen.getByText("First Post")).toBeInTheDocument();
    expect(screen.queryByText("de")).toBeNull();
  });

  it("links each card to /public/blog/{id} (by id, not slug)", async () => {
    stubFetch([post({ id: "abc-123", slug: "the-slug" })]);
    render(await PublicBlogPage());
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/public/blog/abc-123");
  });

  it("renders the card image with the raw (unoptimized) src", async () => {
    stubFetch([post({ imageUrl: "https://cdn.example.com/x.jpg" })]);
    const { container } = render(await PublicBlogPage());
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example.com/x.jpg");
  });
});

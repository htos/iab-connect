// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

/**
 * E28-S1 characterization net — public blog DETAIL — ADAPTED to RSC in S2
 * (A88/A79). The page flipped client→async Server Component reading `params` as a
 * prop (was `useParams`). The harness adapts `render(<Page/>)` → `render(await
 * Page({ params }))` + mocks `next-intl/server` `getTranslations` (the Share button
 * island receives its resolved label as a prop, so it needs no translator). The
 * BEHAVIOURAL assertions — the SINGLE GENERIC ERROR BLOCK (no 404), `<h1>=title`,
 * `\n`-paragraphs, the literal `Tags` heading, the Share button, the de-CH date —
 * are UNCHANGED.
 *
 * Principal A79 delta: the client loading-spinner test is removed (RSC).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (_ns?: string) => (k: string) => k,
}));

import PublicBlogDetailPage from "./page";

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
};

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    title: "Detail Title",
    slug: "detail-title",
    excerpt: "x",
    content: "Body",
    author: "Alice",
    category: "News",
    tags: [],
    publishedAt: "2026-07-01T10:00:00Z",
    ...overrides,
  };
}

function stubFetch(value: Post | null, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => value }) as unknown as Response)
  );
}

const params = Promise.resolve({ id: "post-1" });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PublicBlogDetailPage (E28-S1 characterization, RSC-adapted)", () => {
  it("fetches the post by id from /api/v1/blog/public/{id}", async () => {
    const fetchMock = vi.fn(
      async (_url?: unknown) =>
        ({ ok: true, json: async () => post() }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);
    render(await PublicBlogDetailPage({ params }));
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/blog/public/post-1"
    );
  });

  it("renders the generic error block (no distinct 404) for a missing/unpublished post", async () => {
    stubFetch(null, false);
    render(await PublicBlogDetailPage({ params }));
    expect(screen.getByText("errorMessage")).toBeInTheDocument();
    const back = screen.getByRole("link", { name: "backToBlog" });
    expect(back.getAttribute("href")).toBe("/public/blog");
  });

  it("renders the post title as the <h1>", async () => {
    stubFetch(post({ title: "The Headline" }));
    const { container } = render(await PublicBlogDetailPage({ params }));
    expect(container.querySelector("h1")?.textContent).toBe("The Headline");
  });

  it("splits the content on newlines into paragraphs", async () => {
    stubFetch(post({ content: "Para one\n\nPara two\nPara three" }));
    render(await PublicBlogDetailPage({ params }));
    expect(screen.getByText("Para one")).toBeInTheDocument();
    expect(screen.getByText("Para two")).toBeInTheDocument();
    expect(screen.getByText("Para three")).toBeInTheDocument();
  });

  it("renders the hardcoded literal 'Tags' heading and #-prefixed tags when tags exist", async () => {
    stubFetch(post({ tags: ["alpha", "beta"] }));
    render(await PublicBlogDetailPage({ params }));
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("#alpha")).toBeInTheDocument();
    expect(screen.getByText("#beta")).toBeInTheDocument();
  });

  it("omits the Tags section when the post has no tags", async () => {
    stubFetch(post({ tags: [] }));
    render(await PublicBlogDetailPage({ params }));
    expect(screen.getByText("Detail Title")).toBeInTheDocument();
    expect(screen.queryByText("Tags")).toBeNull();
  });

  it("renders the Share button (copyLink) under the share heading", async () => {
    stubFetch(post());
    render(await PublicBlogDetailPage({ params }));
    expect(
      screen.getByRole("button", { name: "copyLink" })
    ).toBeInTheDocument();
  });

  it("formats the published date with the de-CH long-date format", async () => {
    const iso = "2026-07-01T10:00:00Z";
    const expected = new Date(iso).toLocaleDateString("de-CH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    stubFetch(post({ publishedAt: iso }));
    render(await PublicBlogDetailPage({ params }));
    // Rendered twice (header + author block).
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });
});

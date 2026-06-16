// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

/**
 * E28-S1 characterization net — public events LIST — ADAPTED to RSC in S2
 * (A88/A79). The page flipped client→async Server Component: the SC fetches + SSRs
 * the hero, and the search + category filter + content area (error/empty/grid) live
 * in the `<EventsFilter>` client island. The harness adapts `render(<Page/>)` →
 * `render(await Page())` + mocks BOTH `next-intl/server` `getTranslations` (the SC
 * hero) and `next-intl` `useTranslations` (the island). Behavioural assertions —
 * error (raw string) / empty, 2-field search + category select, free/CHF/paid +
 * ended badges, image alt / placeholder — are UNCHANGED. Companion to the
 * pre-existing `events/page.contentlanguage.test.tsx` (also RSC-adapted).
 *
 * Principal A79 delta: the client loading-spinner test is removed (RSC).
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

import PublicEventsPage from "./page";

type Ev = {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  registrationRequired: boolean;
  waitlistEnabled: boolean;
  visibility: string;
  status: string;
  category: string;
  tags: string[];
  isFree: boolean;
  cost?: number;
  imageUrl?: string;
  imageAltText?: string;
  shortDescription?: string;
  hasStarted: boolean;
  hasEnded: boolean;
  isRegistrationOpen: boolean;
};

function ev(overrides: Partial<Ev> = {}): Ev {
  return {
    id: "e1",
    title: "Concert",
    description: "desc",
    location: "Hall A",
    startDate: "2026-07-01T10:00:00Z",
    endDate: "2026-07-01T12:00:00Z",
    isAllDay: false,
    registrationRequired: false,
    waitlistEnabled: false,
    visibility: "Public",
    status: "Published",
    category: "Music",
    tags: [],
    isFree: true,
    hasStarted: false,
    hasEnded: false,
    isRegistrationOpen: true,
    ...overrides,
  };
}

function stubFetch(events: Ev[], ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        ({ ok, status, json: async () => events }) as unknown as Response
    )
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PublicEventsPage (E28-S1 characterization, RSC-adapted)", () => {
  it("fetches the public events feed from /api/v1/events/public", async () => {
    const fetchMock = vi.fn(
      async (_url?: unknown) =>
        ({ ok: true, status: 200, json: async () => [] }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);
    render(await PublicEventsPage());
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/events/public"
    );
  });

  it("renders the error title plus the raw error string on fetch failure", async () => {
    stubFetch([], false, 500);
    render(await PublicEventsPage());
    expect(screen.getByText("errorTitle")).toBeInTheDocument();
    expect(screen.getByText("HTTP 500")).toBeInTheDocument();
  });

  it("renders the empty copy (noEvents + subtitle) when there are no events", async () => {
    stubFetch([]);
    render(await PublicEventsPage());
    expect(screen.getByText("noEvents")).toBeInTheDocument();
    expect(screen.getByText("noEventsSubtitle")).toBeInTheDocument();
  });

  it("filters by the 2-field search (title OR location)", async () => {
    stubFetch([
      ev({ id: "a", title: "Concert", location: "Hall A" }),
      ev({ id: "b", title: "Workshop", location: "Room B" }),
    ]);
    render(await PublicEventsPage());
    expect(screen.getByText("Concert")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), {
      target: { value: "concert" },
    });
    expect(screen.getByText("Concert")).toBeInTheDocument();
    expect(screen.queryByText("Workshop")).toBeNull();

    // Location match
    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), {
      target: { value: "room" },
    });
    expect(screen.getByText("Workshop")).toBeInTheDocument();
    expect(screen.queryByText("Concert")).toBeNull();
  });

  it("filters by the category <select> (categories derived from the feed)", async () => {
    stubFetch([
      ev({ id: "a", title: "Concert", category: "Music" }),
      ev({ id: "b", title: "Talk", category: "Lecture" }),
    ]);
    render(await PublicEventsPage());
    expect(screen.getByText("Concert")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Lecture" },
    });
    expect(screen.getByText("Talk")).toBeInTheDocument();
    expect(screen.queryByText("Concert")).toBeNull();
  });

  it("renders the free / CHF-cost / paid badge variants", async () => {
    stubFetch([
      ev({ id: "free", title: "Free One", isFree: true }),
      ev({ id: "cost", title: "Cost One", isFree: false, cost: 50 }),
      ev({ id: "paid", title: "Paid One", isFree: false, cost: undefined }),
    ]);
    render(await PublicEventsPage());
    expect(screen.getByText("Free One")).toBeInTheDocument();
    expect(screen.getByText("free")).toBeInTheDocument();
    expect(screen.getByText("CHF 50")).toBeInTheDocument();
    expect(screen.getByText("paid")).toBeInTheDocument();
  });

  it("renders the 'ended' chip for an event that has ended", async () => {
    stubFetch([ev({ title: "Past Event", hasEnded: true })]);
    render(await PublicEventsPage());
    expect(screen.getByText("Past Event")).toBeInTheDocument();
    expect(screen.getByText("ended")).toBeInTheDocument();
  });

  it("formats the start date with the de-CH date-with-time format", async () => {
    const iso = "2026-07-01T10:00:00Z";
    const expected = new Date(iso).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    stubFetch([ev({ startDate: iso })]);
    render(await PublicEventsPage());
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("uses imageAltText ?? title for the card image and a placeholder when no image", async () => {
    stubFetch([
      ev({
        id: "img",
        title: "Withimg",
        imageUrl: "https://cdn.example.com/e.jpg",
        imageAltText: "Alt text",
      }),
    ]);
    const { container } = render(await PublicEventsPage());
    expect(container.querySelector("img")?.getAttribute("alt")).toBe(
      "Alt text"
    );

    cleanup();
    stubFetch([ev({ id: "noimg", title: "Noimg", imageUrl: undefined })]);
    const { container: c2 } = render(await PublicEventsPage());
    expect(screen.getByText("Noimg")).toBeInTheDocument();
    expect(c2.querySelector("img")).toBeNull();
  });
});

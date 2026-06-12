// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-055 (E7-S4) AC-3: the public events list surfaces the content-language
// metadata as a badge WITHOUT changing the route. ADAPTED to RSC in E28-S2
// (A88/A79): the list flipped client→async Server Component, so the render harness
// is `render(await Page())` + a `next-intl/server` `getTranslations` mock for the
// SC hero; the content-language badge now renders inside the `<EventsFilter>` client
// island (still `useTranslations("language")` — STABLE per-namespace, A64). The
// behavioural assertion (the native language name renders / is absent) is UNCHANGED.

vi.mock("next-intl/server", () => ({
  getTranslations: async (_ns?: string) => (k: string) => k,
}));

vi.mock("next-intl", () => {
  const langMap: Record<string, string> = {
    de: "Deutsch",
    en: "English",
    hi: "हिन्दी",
  };
  const translators: Record<string, (k: string) => string> = {};
  return {
    useTranslations: (ns?: string) => {
      const key = ns ?? "_";
      if (!translators[key]) {
        translators[key] = (k: string) =>
          key === "language" ? (langMap[k] ?? k) : k;
      }
      return translators[key];
    },
  };
});

import PublicEventsPage from "./page";

function eventWith(contentLanguage?: string) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Test Event",
    description: "Description",
    location: "Hall",
    startDate: "2026-07-01T10:00:00Z",
    endDate: "2026-07-01T12:00:00Z",
    isAllDay: false,
    registrationRequired: false,
    waitlistEnabled: false,
    visibility: "Public",
    status: "Published",
    category: "Cultural",
    tags: [],
    isFree: true,
    contentLanguage,
    hasStarted: false,
    hasEnded: false,
    isRegistrationOpen: true,
  };
}

function stubFetch(events: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => events,
    }))
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PublicEventsPage content-language badge (E7-S4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the native language name when an event has a content language", async () => {
    stubFetch([eventWith("de")]);
    render(await PublicEventsPage());
    expect(screen.getByText("Test Event")).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
  });

  it("renders no language badge when an event has no content language", async () => {
    stubFetch([eventWith(undefined)]);
    render(await PublicEventsPage());
    expect(screen.getByText("Test Event")).toBeInTheDocument();
    expect(screen.queryByText("Deutsch")).toBeNull();
    expect(screen.queryByText("English")).toBeNull();
  });
});

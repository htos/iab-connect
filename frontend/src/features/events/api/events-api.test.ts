import { describe, expect, it, vi } from "vitest";
import {
  cancelEvent,
  createEvent,
  deleteEvent,
  eventsKeys,
  fetchEvents,
  fetchEventStatistics,
  getEvent,
  publishEvent,
  unpublishEvent,
  updateEvent,
  type ListEventsFilters,
} from "./events-api";
import type { useApiClient } from "@/lib/auth";

/**
 * E24-S2: the events slice api owns every event-CRUD URL (no raw `/api/v1/...`
 * in components). These assert each function hits the right verb + the
 * byte-identical URL/body the god-pages used today — most importantly the list
 * query string (page + pageSize=12 always; search/status/category only when
 * non-empty, in that order).
 */

type ApiClient = ReturnType<typeof useApiClient>;

function makeApi() {
  return {
    get: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
    post: vi.fn(() =>
      Promise.resolve({ data: null, error: null, status: 200 })
    ),
    put: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
    delete: vi.fn(() =>
      Promise.resolve({ data: null, error: null, status: 200 })
    ),
    upload: vi.fn(),
  } as unknown as ApiClient & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

const baseFilters: ListEventsFilters = {
  page: 1,
  search: "",
  status: "",
  category: "",
};

describe("eventsKeys", () => {
  it("exposes the stable key shapes", () => {
    expect(eventsKeys.all).toEqual(["events"]);
    expect(eventsKeys.statistics()).toEqual(["events", "statistics"]);
    expect(eventsKeys.detail("e1")).toEqual(["events", "detail", "e1"]);
    expect(eventsKeys.list(baseFilters)).toEqual([
      "events",
      "list",
      { page: 1, search: "", status: "", category: "" },
    ]);
  });
});

describe("fetchEvents query string (byte-identical to the god-page)", () => {
  it("sends only page + pageSize=12 when filters are empty", () => {
    const api = makeApi();
    fetchEvents(api, baseFilters);
    expect(api.get).toHaveBeenCalledWith("/api/v1/events?page=1&pageSize=12");
  });

  it("appends search/status/category in order, only when non-empty", () => {
    const api = makeApi();
    fetchEvents(api, {
      page: 3,
      search: "gala night",
      status: "Published",
      category: "Social",
    });
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events?page=3&pageSize=12&search=gala+night&status=Published&category=Social"
    );
  });

  it("omits blank middle filters but keeps the rest", () => {
    const api = makeApi();
    fetchEvents(api, {
      page: 2,
      search: "",
      status: "Draft",
      category: "",
    });
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events?page=2&pageSize=12&status=Draft"
    );
  });
});

describe("event endpoint URLs + bodies", () => {
  it("fetchEventStatistics -> GET /api/v1/events/statistics", () => {
    const api = makeApi();
    fetchEventStatistics(api);
    expect(api.get).toHaveBeenCalledWith("/api/v1/events/statistics");
  });

  it("getEvent -> GET /api/v1/events/{id}", () => {
    const api = makeApi();
    getEvent(api, "e1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/events/e1");
  });

  it("createEvent -> POST /api/v1/events with the body", () => {
    const api = makeApi();
    const body = { title: "T" } as never;
    createEvent(api, body);
    expect(api.post).toHaveBeenCalledWith("/api/v1/events", body);
  });

  it("updateEvent -> PUT /api/v1/events/{id} with the body", () => {
    const api = makeApi();
    const body = { title: "T" } as never;
    updateEvent(api, "e1", body);
    expect(api.put).toHaveBeenCalledWith("/api/v1/events/e1", body);
  });

  it("publishEvent -> POST /api/v1/events/{id}/publish with empty body", () => {
    const api = makeApi();
    publishEvent(api, "e1");
    expect(api.post).toHaveBeenCalledWith("/api/v1/events/e1/publish", {});
  });

  it("unpublishEvent -> POST /api/v1/events/{id}/unpublish with empty body", () => {
    const api = makeApi();
    unpublishEvent(api, "e1");
    expect(api.post).toHaveBeenCalledWith("/api/v1/events/e1/unpublish", {});
  });

  it("cancelEvent -> POST /api/v1/events/{id}/cancel with { reason }", () => {
    const api = makeApi();
    cancelEvent(api, "e1", "venue closed");
    expect(api.post).toHaveBeenCalledWith("/api/v1/events/e1/cancel", {
      reason: "venue closed",
    });
  });

  it("cancelEvent sends { reason: undefined } when omitted (god-page parity)", () => {
    const api = makeApi();
    cancelEvent(api, "e1");
    expect(api.post).toHaveBeenCalledWith("/api/v1/events/e1/cancel", {
      reason: undefined,
    });
  });

  it("deleteEvent -> DELETE /api/v1/events/{id}", () => {
    const api = makeApi();
    deleteEvent(api, "e1");
    expect(api.delete).toHaveBeenCalledWith("/api/v1/events/e1");
  });
});

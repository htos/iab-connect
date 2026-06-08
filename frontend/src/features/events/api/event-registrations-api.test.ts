import { describe, expect, it, vi } from "vitest";
import {
  cancelEventRegistration,
  checkInRegistration,
  confirmEventRegistration,
  getEventRegistration,
  getEventRegistrations,
  getEventRegistrationStatistics,
  getEventWaitlist,
  getMyRegistrations,
  markRegistrationAsNoShow,
  promoteFromWaitlist,
  registerForEvent,
  registrationsExportCsvUrl,
  registrationsExportPdfUrl,
  revertRegistrationCancellation,
  revertRegistrationCheckIn,
  revertRegistrationNoShow,
  updateEventRegistration,
} from "./event-registrations-api";
import type { useApiClient } from "@/lib/auth";

/**
 * E24-S3: the event-registrations sub-domain api owns every registration URL (no
 * raw `/api/v1/...` in components). These assert each function hits the right
 * verb + the byte-identical URL/body the registrations god-page used today —
 * most importantly the list query string (status → isWaitlisted → searchTerm →
 * page → pageSize, only when set; pageSize=20 from the page).
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

describe("getEventRegistrations query string (byte-identical to the god-page)", () => {
  it("sends no query when no params", () => {
    const api = makeApi();
    getEventRegistrations(api, "e1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/events/e1/registrations");
  });

  it("sends page + pageSize=20 (the god-page paging)", () => {
    const api = makeApi();
    getEventRegistrations(api, "e1", { page: 1, pageSize: 20 });
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations?page=1&pageSize=20"
    );
  });

  it("appends status → searchTerm → page → pageSize in order, only when set", () => {
    const api = makeApi();
    getEventRegistrations(api, "e1", {
      status: "Confirmed",
      searchTerm: "cara",
      page: 1,
      pageSize: 20,
    });
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations?status=Confirmed&searchTerm=cara&page=1&pageSize=20"
    );
  });

  it("includes isWaitlisted between status and searchTerm when provided", () => {
    const api = makeApi();
    getEventRegistrations(api, "e1", {
      status: "Waitlisted",
      isWaitlisted: true,
      page: 2,
      pageSize: 20,
    });
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations?status=Waitlisted&isWaitlisted=true&page=2&pageSize=20"
    );
  });
});

describe("registration endpoint URLs + bodies", () => {
  it("getEventRegistrationStatistics -> GET .../registrations/statistics", () => {
    const api = makeApi();
    getEventRegistrationStatistics(api, "e1");
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/statistics"
    );
  });

  it("confirmEventRegistration -> POST .../confirm with {}", () => {
    const api = makeApi();
    confirmEventRegistration(api, "e1", "r1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/r1/confirm",
      {}
    );
  });

  it("checkInRegistration -> POST .../check-in with {}", () => {
    const api = makeApi();
    checkInRegistration(api, "e1", "r1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/r1/check-in",
      {}
    );
  });

  it("markRegistrationAsNoShow -> POST .../no-show with {}", () => {
    const api = makeApi();
    markRegistrationAsNoShow(api, "e1", "r1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/r1/no-show",
      {}
    );
  });

  it("revertRegistrationNoShow -> POST .../revert-no-show with {}", () => {
    const api = makeApi();
    revertRegistrationNoShow(api, "e1", "r1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/r1/revert-no-show",
      {}
    );
  });

  it("revertRegistrationCheckIn -> POST .../revert-check-in with {}", () => {
    const api = makeApi();
    revertRegistrationCheckIn(api, "e1", "r1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/r1/revert-check-in",
      {}
    );
  });

  it("revertRegistrationCancellation -> POST .../revert-cancellation with {}", () => {
    const api = makeApi();
    revertRegistrationCancellation(api, "e1", "r1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/r1/revert-cancellation",
      {}
    );
  });

  it("cancelEventRegistration -> POST .../cancel with { reason }", () => {
    const api = makeApi();
    cancelEventRegistration(api, "e1", "r1", "changed mind");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/r1/cancel",
      { reason: "changed mind" }
    );
  });

  it("cancelEventRegistration sends { reason: undefined } when omitted", () => {
    const api = makeApi();
    cancelEventRegistration(api, "e1", "r1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/r1/cancel",
      { reason: undefined }
    );
  });

  it("promoteFromWaitlist -> POST .../promote-from-waitlist with {}", () => {
    const api = makeApi();
    promoteFromWaitlist(api, "e1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/promote-from-waitlist",
      {}
    );
  });
});

describe("member-facing surface (detail-page seam)", () => {
  it("registerForEvent -> POST .../registrations with the body (defaults to {})", () => {
    const api = makeApi();
    registerForEvent(api, "e1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations",
      {}
    );
    const body = { numberOfGuests: 2, specialRequirements: "vegan" };
    registerForEvent(api, "e1", body);
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations",
      body
    );
  });

  it("getMyRegistrations -> GET /api/v1/my-registrations (not under event path)", () => {
    const api = makeApi();
    getMyRegistrations(api);
    expect(api.get).toHaveBeenCalledWith("/api/v1/my-registrations");
  });

  it("getEventWaitlist -> GET .../registrations/waitlist", () => {
    const api = makeApi();
    getEventWaitlist(api, "e1");
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/waitlist"
    );
  });

  it("getEventRegistration -> GET .../registrations/{regId}", () => {
    const api = makeApi();
    getEventRegistration(api, "e1", "r1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/events/e1/registrations/r1");
  });

  it("updateEventRegistration -> PUT .../registrations/{regId} with the body", () => {
    const api = makeApi();
    const body = {
      participantName: "X",
      participantEmail: "x@y.z",
      numberOfGuests: 0,
    };
    updateEventRegistration(api, "e1", "r1", body);
    expect(api.put).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/r1",
      body
    );
  });
});

describe("export URL builders (byte-identical to the god-page)", () => {
  it("registrationsExportPdfUrl -> .../registrations/export-pdf", () => {
    expect(registrationsExportPdfUrl("e1")).toBe(
      "/api/v1/events/e1/registrations/export-pdf"
    );
  });

  it("registrationsExportCsvUrl -> /api/v1/reports/export/events/{id}/registrations", () => {
    expect(registrationsExportCsvUrl("e1")).toBe(
      "/api/v1/reports/export/events/e1/registrations"
    );
  });
});

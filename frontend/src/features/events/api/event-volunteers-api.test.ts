import { describe, expect, it, vi } from "vitest";
import {
  cancelVolunteerShift,
  createVolunteerRole,
  createVolunteerShift,
  getEventVolunteerRoles,
  getEventVolunteerShifts,
  getMyWaitlistPosition,
  getVolunteerShiftAssignments,
  signUpForVolunteerShift,
  updateVolunteerRole,
  updateVolunteerShift,
  withdrawFromVolunteerShift,
} from "./event-volunteers-api";
import type { useApiClient } from "@/lib/auth";

/**
 * E24-S3: the events VOLUNTEER sub-domain api owns every volunteer endpoint URL
 * (no raw `/api/v1/...` in components). These assert each function hits the right
 * verb + the byte-identical URL/body the legacy `events`
 * functions used — most importantly the trailing slashes on the collection
 * endpoints, POST `/cancel` for shift cancellation (NOT DELETE), POST
 * `/self-signup`, and the assignment-scoped `/cancel` for withdraw.
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

describe("volunteer roles endpoints", () => {
  it("getEventVolunteerRoles -> GET .../volunteer-roles/ (trailing slash)", () => {
    const api = makeApi();
    getEventVolunteerRoles(api, "e1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/events/e1/volunteer-roles/");
  });

  it("createVolunteerRole -> POST .../volunteer-roles/ with the body", () => {
    const api = makeApi();
    const body = { name: "Crew", description: "x" };
    createVolunteerRole(api, "e1", body);
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/volunteer-roles/",
      body
    );
  });

  it("updateVolunteerRole -> PUT .../volunteer-roles/{roleId} with the body", () => {
    const api = makeApi();
    const body = { name: "Crew", description: null, isActive: true };
    updateVolunteerRole(api, "e1", "r1", body);
    expect(api.put).toHaveBeenCalledWith(
      "/api/v1/events/e1/volunteer-roles/r1",
      body
    );
  });
});

describe("volunteer shifts endpoints", () => {
  it("getEventVolunteerShifts -> GET .../volunteer-shifts/ (trailing slash)", () => {
    const api = makeApi();
    getEventVolunteerShifts(api, "e1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/events/e1/volunteer-shifts/");
  });

  it("createVolunteerShift -> POST .../volunteer-shifts/ with the body", () => {
    const api = makeApi();
    const body = {
      roleId: "r1",
      title: "T",
      startsAt: "2026-07-01T10:00:00.000Z",
      endsAt: "2026-07-01T12:00:00.000Z",
      capacity: 1,
      allowWaitlist: false,
      allowSelfSignup: false,
    } as never;
    createVolunteerShift(api, "e1", body);
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/volunteer-shifts/",
      body
    );
  });

  it("updateVolunteerShift -> PUT .../volunteer-shifts/{shiftId} with the body", () => {
    const api = makeApi();
    const body = { title: "T" } as never;
    updateVolunteerShift(api, "e1", "s1", body);
    expect(api.put).toHaveBeenCalledWith(
      "/api/v1/events/e1/volunteer-shifts/s1",
      body
    );
  });

  it("cancelVolunteerShift -> POST .../volunteer-shifts/{shiftId}/cancel with { reason: null }", () => {
    const api = makeApi();
    cancelVolunteerShift(api, "e1", "s1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/volunteer-shifts/s1/cancel",
      { reason: null }
    );
  });

  it("cancelVolunteerShift passes a provided reason through", () => {
    const api = makeApi();
    cancelVolunteerShift(api, "e1", "s1", "venue closed");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/volunteer-shifts/s1/cancel",
      { reason: "venue closed" }
    );
  });
});

describe("volunteer assignments + self-signup endpoints", () => {
  it("getVolunteerShiftAssignments -> GET .../volunteer-shifts/{shiftId}/assignments", () => {
    const api = makeApi();
    getVolunteerShiftAssignments(api, "e1", "s1");
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events/e1/volunteer-shifts/s1/assignments"
    );
  });

  it("signUpForVolunteerShift -> POST .../self-signup with { allowWaitlistFallback: false } by default", () => {
    const api = makeApi();
    signUpForVolunteerShift(api, "e1", "s1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/volunteer-shifts/s1/self-signup",
      { allowWaitlistFallback: false }
    );
  });

  it("signUpForVolunteerShift forwards allowWaitlistFallback=true", () => {
    const api = makeApi();
    signUpForVolunteerShift(api, "e1", "s1", true);
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/volunteer-shifts/s1/self-signup",
      { allowWaitlistFallback: true }
    );
  });

  it("withdrawFromVolunteerShift -> POST .../assignments/{assignmentId}/cancel with { reason: null }", () => {
    const api = makeApi();
    withdrawFromVolunteerShift(api, "e1", "s1", "a1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/e1/volunteer-shifts/s1/assignments/a1/cancel",
      { reason: null }
    );
  });

  it("getMyWaitlistPosition -> GET .../registrations/my-position", () => {
    const api = makeApi();
    getMyWaitlistPosition(api, "e1");
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events/e1/registrations/my-position"
    );
  });
});

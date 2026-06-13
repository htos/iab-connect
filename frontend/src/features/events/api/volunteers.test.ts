import { afterEach, describe, expect, it, vi } from "vitest";
// A62: the manager volunteer wrappers (createVolunteerRole / createVolunteerShift / …) were removed
// from the service — the slice (`features/events/api/event-volunteers-api.ts`) owns them now and is
// covered by `event-volunteers-api.test.ts`. This file keeps only the member self-signup wrappers
// (getEventVolunteerShifts / signUpForVolunteerShift / withdrawFromVolunteerShift) that VolunteerSelf-
// SignupSection still relies on (they need `ApiResult.errorBody.errorCode`, which useApiClient can't
// express).
import {
  type EventVolunteerShiftDto,
  getEventVolunteerShifts,
  signUpForVolunteerShift,
  withdrawFromVolunteerShift,
} from "./events-transport";

const API_BASE = "http://localhost:5000";

describe("volunteer service wrappers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getEventVolunteerShifts hits the expected URL and returns parsed payload", async () => {
    const payload: EventVolunteerShiftDto[] = [
      {
        id: "s1",
        eventId: "e1",
        roleId: "r1",
        roleName: "Greeter",
        title: "Morning",
        description: null,
        startsAt: "2026-05-13T10:00:00Z",
        endsAt: "2026-05-13T12:00:00Z",
        capacity: 5,
        confirmedCount: 1,
        waitlistCount: 0,
        allowWaitlist: true,
        allowSelfSignup: true,
        notes: null,
        createdAt: "2026-05-13T09:00:00Z",
      },
    ];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const res = await getEventVolunteerShifts("e1");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(`${API_BASE}/api/v1/events/e1/volunteer-shifts/`);
    expect((calledInit as RequestInit).method).toBe("GET");
    expect(res.success).toBe(true);
    expect(res.data).toEqual(payload);
  });

  it("signUpForVolunteerShift surfaces 409 errorCode in errorBody", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Shift full", errorCode: "ShiftFull" }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const res = await signUpForVolunteerShift("e1", "s1");

    expect(res.success).toBe(false);
    expect(res.status).toBe(409);
    expect(res.errorBody?.errorCode).toBe("ShiftFull");
    expect(res.error).toBe("Shift full");
  });

  it("signUpForVolunteerShift surfaces 403 SignupNotAllowed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Self-signup is disabled",
          errorCode: "SignupNotAllowed",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const res = await signUpForVolunteerShift("e1", "s1");

    expect(res.status).toBe(403);
    expect(res.errorBody?.errorCode).toBe("SignupNotAllowed");
  });

  it("signUpForVolunteerShift returns AlreadyAssigned on the conflict path", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Already assigned",
          errorCode: "AlreadyAssigned",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const res = await signUpForVolunteerShift("e1", "s1");

    expect(res.errorBody?.errorCode).toBe("AlreadyAssigned");
  });

  it("withdrawFromVolunteerShift POSTs to the cancel sub-resource URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await withdrawFromVolunteerShift("e1", "s1", "a1", "changed plans");

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      `${API_BASE}/api/v1/events/e1/volunteer-shifts/s1/assignments/a1/cancel`
    );
    const body = JSON.parse((calledInit as RequestInit).body as string);
    expect(body).toEqual({ reason: "changed plans" });
  });
});

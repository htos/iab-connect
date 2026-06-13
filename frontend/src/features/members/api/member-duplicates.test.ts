import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findMemberDuplicates,
  parseMatchReason,
  getDuplicateGroups,
  dismissDuplicateCandidate,
  mergeMembers,
  type DuplicateCandidateDto,
  type DuplicateGroupDto,
  type DismissDuplicateCandidateResult,
  type MergeMembersResult,
} from "./member-duplicates";
import type { PagedResult } from "@/types/common";

const API_BASE = "http://localhost:5000";

describe("findMemberDuplicates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("composes the URL with every provided query parameter", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await findMemberDuplicates("access-token", {
      email: "max@example.com",
      phone: "+41 79 123 45 67",
      firstName: "Max",
      lastName: "Muster",
      postalCode: "8000",
      excludeMemberId: "11111111-1111-1111-1111-111111111111",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      `${API_BASE}/api/v1/members/duplicates?` +
        "email=max%40example.com&phone=%2B41+79+123+45+67&firstName=Max" +
        "&lastName=Muster&postalCode=8000&excludeMemberId=11111111-1111-1111-1111-111111111111"
    );
    expect(calledInit).toEqual({
      headers: { Authorization: "Bearer access-token" },
    });
  });

  it("omits query parameters that are empty or undefined", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await findMemberDuplicates("access-token", {
      email: "max@example.com",
      phone: "",
      firstName: undefined,
      lastName: "Muster",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/members/duplicates?email=max%40example.com&lastName=Muster`,
      { headers: { Authorization: "Bearer access-token" } }
    );
  });

  it("returns the typed candidate array on 200", async () => {
    const payload: DuplicateCandidateDto[] = [
      {
        id: "22222222-2222-2222-2222-222222222222",
        firstName: "Max",
        lastName: "Muster",
        email: "max@example.com",
        membershipStatus: "Active",
        memberSince: "2024-01-15",
        matchTier: "Exact",
        matchReason: "Email",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await findMemberDuplicates("access-token", {
      email: "max@example.com",
    });

    expect(result).toHaveLength(1);
    expect(result[0].matchTier).toBe("Exact");
    expect(result[0].id).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("throws a sanitized error on non-2xx responses without leaking the body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("sensitive backend trace", { status: 500 })
    );

    await expect(
      findMemberDuplicates("access-token", { email: "max@example.com" })
    ).rejects.toThrow("Failed to fetch duplicate candidates: 500");
  });
});

describe("getDuplicateGroups", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("composes the URL with page, pageSize and minTier when provided", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          totalCount: 0,
          page: 2,
          pageSize: 10,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await getDuplicateGroups("access-token", {
      page: 2,
      pageSize: 10,
      minTier: "Exact",
    });

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      `${API_BASE}/api/v1/members/duplicate-groups?page=2&pageSize=10&minTier=Exact`
    );
    expect(calledInit).toEqual({
      headers: { Authorization: "Bearer access-token" },
    });
  });

  it("omits all query parameters when none are provided", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await getDuplicateGroups("access-token");

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/members/duplicate-groups`,
      { headers: { Authorization: "Bearer access-token" } }
    );
  });

  it("returns the typed paged result on 200", async () => {
    const payload: PagedResult<DuplicateGroupDto> = {
      items: [
        {
          groupKey: "email::max@example.com",
          tier: "Exact",
          members: [
            {
              id: "11111111-1111-1111-1111-111111111111",
              firstName: "Max",
              lastName: "Muster",
              email: "max@example.com",
              membershipStatus: "Active",
              memberSince: "2024-01-15",
              matchTier: "Exact",
              matchReason: "Email",
            },
          ],
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await getDuplicateGroups("access-token");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].tier).toBe("Exact");
    expect(result.items[0].groupKey).toBe("email::max@example.com");
  });

  it("throws a sanitized error on non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("sensitive backend trace", { status: 500 })
    );

    await expect(getDuplicateGroups("access-token")).rejects.toThrow(
      "Failed to fetch duplicate groups: 500"
    );
  });
});

describe("dismissDuplicateCandidate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs the canonicalized body and surfaces the created result", async () => {
    const payload: DismissDuplicateCandidateResult = {
      dismissalId: "33333333-3333-3333-3333-333333333333",
      sourceMemberId: "11111111-1111-1111-1111-111111111111",
      targetMemberId: "22222222-2222-2222-2222-222222222222",
      created: true,
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await dismissDuplicateCandidate("access-token", {
      memberA: "11111111-1111-1111-1111-111111111111",
      memberB: "22222222-2222-2222-2222-222222222222",
      reason: "False positive — different people.",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(`${API_BASE}/api/v1/members/duplicate-dismissals`);
    expect(calledInit?.method).toBe("POST");
    expect(calledInit?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer access-token",
    });
    expect(JSON.parse(calledInit?.body as string)).toEqual({
      memberA: "11111111-1111-1111-1111-111111111111",
      memberB: "22222222-2222-2222-2222-222222222222",
      reason: "False positive — different people.",
    });
    expect(result.created).toBe(true);
  });

  it("returns created=false for idempotent re-dismissal (server 200)", async () => {
    const payload: DismissDuplicateCandidateResult = {
      dismissalId: "33333333-3333-3333-3333-333333333333",
      sourceMemberId: "11111111-1111-1111-1111-111111111111",
      targetMemberId: "22222222-2222-2222-2222-222222222222",
      created: false,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await dismissDuplicateCandidate("access-token", {
      memberA: "11111111-1111-1111-1111-111111111111",
      memberB: "22222222-2222-2222-2222-222222222222",
      reason: "Already dismissed earlier.",
    });

    expect(result.created).toBe(false);
    expect(result.dismissalId).toBe("33333333-3333-3333-3333-333333333333");
  });

  it("throws on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404 })
    );
    await expect(
      dismissDuplicateCandidate("access-token", {
        memberA: "11111111-1111-1111-1111-111111111111",
        memberB: "22222222-2222-2222-2222-222222222222",
        reason: "x",
      })
    ).rejects.toThrow("Failed to dismiss duplicate candidate: 404");
  });
});

describe("mergeMembers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("composes the URL with source and target ids and POSTs the body", async () => {
    const payload: MergeMembersResult = {
      targetId: "22222222-2222-2222-2222-222222222222",
      sourceId: "11111111-1111-1111-1111-111111111111",
      movedReferences: {
        "MemberSegmentAssignment.PreDeduped": 0,
        MemberSegmentAssignment: 1,
        EventRegistration: 0,
        EmailRecipient: 0,
        "ExpenseClaim.Draft": 0,
        "Invoice.Draft": 0,
        "Member.KeycloakLink": 0,
      },
      auditEventId: "44444444-4444-4444-4444-444444444444",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await mergeMembers("access-token", {
      sourceId: "11111111-1111-1111-1111-111111111111",
      targetId: "22222222-2222-2222-2222-222222222222",
      reason: "Manual merge by admin.",
      confirmFinanceImpact: false,
      confirmKeycloakImpact: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      `${API_BASE}/api/v1/members/11111111-1111-1111-1111-111111111111/merge-into/22222222-2222-2222-2222-222222222222`
    );
    expect(calledInit?.method).toBe("POST");
    expect(JSON.parse(calledInit?.body as string)).toEqual({
      reason: "Manual merge by admin.",
      confirmFinanceImpact: false,
      confirmKeycloakImpact: false,
    });
    expect(result.movedReferences.MemberSegmentAssignment).toBe(1);
  });

  it("throws with status code on 409 Conflict (unsafe merge blockers)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ reasons: ["Source has 1 sent invoice."] }),
        {
          status: 409,
        }
      )
    );

    await expect(
      mergeMembers("access-token", {
        sourceId: "11111111-1111-1111-1111-111111111111",
        targetId: "22222222-2222-2222-2222-222222222222",
        reason: "x",
        confirmFinanceImpact: false,
        confirmKeycloakImpact: false,
      })
    ).rejects.toThrow("Failed to merge members: 409");
  });
});

describe("parseMatchReason", () => {
  it("returns an empty array for 'None'", () => {
    expect(parseMatchReason("None")).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseMatchReason("")).toEqual([]);
  });

  it("returns a single flag for a single value", () => {
    expect(parseMatchReason("Email")).toEqual(["Email"]);
  });

  it("splits a comma-joined flags-enum string and trims whitespace", () => {
    expect(parseMatchReason("NameOnly, EmailLocalPart")).toEqual([
      "NameOnly",
      "EmailLocalPart",
    ]);
  });

  it("handles input without spaces after the comma", () => {
    expect(parseMatchReason("NameOnly,NormalizedPhone")).toEqual([
      "NameOnly",
      "NormalizedPhone",
    ]);
  });
});

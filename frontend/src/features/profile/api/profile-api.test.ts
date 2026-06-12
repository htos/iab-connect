import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E29-S4: the profile slice api owns the `profileKeys` factory + thin wrappers.
 * DEC-1=A: `/members/me` GET/PUT go through `useApiClient`; consent/channel/
 * session wrap `@/lib/api/privacy` + `@/lib/api/users` byte-identically. These
 * assert the key shapes, the `/members/me` URL + method, and that each wrapper
 * delegates with the exact args/URLs the god-page used.
 */

// Mock the shared privacy + users transports — the api layer must delegate to them.
const privacySpy = vi.hoisted(() => ({
  getConsents: vi.fn(() => Promise.resolve([])),
  grantConsent: vi.fn(() => Promise.resolve()),
  revokeConsent: vi.fn(() => Promise.resolve()),
  getChannelPreference: vi.fn(() => Promise.resolve({})),
  updateChannelPreference: vi.fn(() => Promise.resolve()),
}));
const usersSpy = vi.hoisted(() => ({
  getMySessions: vi.fn(() => Promise.resolve({ sessions: [] })),
  revokeMySession: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/api/privacy", () => privacySpy);
vi.mock("@/lib/api/users", () => usersSpy);

import {
  profileKeys,
  getMyProfile,
  updateMyProfile,
  fetchConsents,
  toggleConsent,
  fetchChannelPreference,
  updateChannelPreference,
  fetchMySessions,
  revokeMySession,
} from "./profile-api";

type ApiClient = Parameters<typeof getMyProfile>[0];

function makeApi() {
  const api = {
    get: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
    put: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
    post: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  };
  return api as unknown as ApiClient & typeof api;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("profileKeys", () => {
  it("exposes the stable key shapes", () => {
    expect(profileKeys.all).toEqual(["profile"]);
    expect(profileKeys.me()).toEqual(["profile", "me"]);
    expect(profileKeys.consents()).toEqual(["profile", "consents"]);
    expect(profileKeys.channelPreference()).toEqual([
      "profile",
      "channelPreference",
    ]);
    expect(profileKeys.sessions()).toEqual(["profile", "sessions"]);
  });
});

describe("members/me wrappers (DEC-1=A → useApiClient)", () => {
  it("getMyProfile GETs the byte-identical /api/v1/members/me URL", () => {
    const api = makeApi();
    getMyProfile(api);
    expect(api.get).toHaveBeenCalledWith("/api/v1/members/me");
  });

  it("updateMyProfile PUTs /api/v1/members/me with the body verbatim", () => {
    const api = makeApi();
    const body = {
      firstName: "Anna",
      lastName: "Alpha",
      street: "Hauptstrasse 1",
      city: "Zürich",
      postalCode: "8000",
      country: "CH",
      phone: "+41",
    };
    updateMyProfile(api, body);
    expect(api.put).toHaveBeenCalledWith("/api/v1/members/me", body);
  });
});

describe("consent wrappers (delegate to @/lib/api/privacy)", () => {
  it("fetchConsents delegates with the token", () => {
    fetchConsents("tok");
    expect(privacySpy.getConsents).toHaveBeenCalledWith("tok");
  });

  it("toggleConsent GRANTS when not currently granted", () => {
    toggleConsent("tok", "Newsletter", false);
    expect(privacySpy.grantConsent).toHaveBeenCalledWith("tok", "Newsletter");
    expect(privacySpy.revokeConsent).not.toHaveBeenCalled();
  });

  it("toggleConsent REVOKES when currently granted", () => {
    toggleConsent("tok", "Newsletter", true);
    expect(privacySpy.revokeConsent).toHaveBeenCalledWith("tok", "Newsletter");
    expect(privacySpy.grantConsent).not.toHaveBeenCalled();
  });
});

describe("channel-preference wrappers (delegate to @/lib/api/privacy)", () => {
  it("fetchChannelPreference delegates with the token", () => {
    fetchChannelPreference("tok");
    expect(privacySpy.getChannelPreference).toHaveBeenCalledWith("tok");
  });

  it("updateChannelPreference forwards (token, preferredChannel)", () => {
    updateChannelPreference("tok", "Sms");
    expect(privacySpy.updateChannelPreference).toHaveBeenCalledWith(
      "tok",
      "Sms"
    );
  });
});

describe("session wrappers (delegate to @/lib/api/users)", () => {
  it("fetchMySessions delegates with the token", () => {
    fetchMySessions("tok");
    expect(usersSpy.getMySessions).toHaveBeenCalledWith("tok");
  });

  it("revokeMySession forwards (token, sessionId)", () => {
    revokeMySession("tok", "session-a");
    expect(usersSpy.revokeMySession).toHaveBeenCalledWith("tok", "session-a");
  });
});

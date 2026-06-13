// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// E30-S2 characterization net: pins the login surface (currently untested) BEFORE
// the features/system slice extraction. Renders the route entry (`./page`), so the
// net survives the body-move into the slice with zero import-path edits (A87/A88).

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signIn: vi.fn(),
  searchParams: new URLSearchParams(),
  auth: { isAuthenticated: false, isLoading: false },
}));

vi.mock("next-auth/react", () => ({
  signIn: mocks.signIn,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}));

// Stable identity translator (A64/A78): login keeps `t` in effect/init deps.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

vi.mock("@/lib/auth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: () => ({
    settings: {
      applicationName: "TestOrg",
      logoBackgroundColor: "#111111",
      logoTextColor: "#ffffff",
      logoText: "TO",
    },
  }),
}));

import LoginPage from "./page";

beforeEach(() => {
  mocks.push.mockReset();
  mocks.signIn.mockReset();
  mocks.searchParams = new URLSearchParams();
  mocks.auth = { isAuthenticated: false, isLoading: false };
});

afterEach(cleanup);

describe("LoginPage (characterization)", () => {
  it("renders the Keycloak sign-in button", () => {
    render(<LoginPage />);
    expect(screen.getByText("auth.signInWithKeycloak")).toBeInTheDocument();
  });

  it("calls signIn('keycloak', { callbackUrl }) with the default callbackUrl '/'", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText("auth.signInWithKeycloak"));
    expect(mocks.signIn).toHaveBeenCalledWith("keycloak", { callbackUrl: "/" });
  });

  it("uses the ?callbackUrl= param when present", () => {
    mocks.searchParams = new URLSearchParams("callbackUrl=/dashboard");
    render(<LoginPage />);
    fireEvent.click(screen.getByText("auth.signInWithKeycloak"));
    expect(mocks.signIn).toHaveBeenCalledWith("keycloak", {
      callbackUrl: "/dashboard",
    });
  });

  it.each([
    ["OAuthCallback", "auth.signInError"],
    ["OAuthSignin", "auth.keycloakNotReachable"],
    ["AccessDenied", "auth.accessDenied"],
    ["SomethingElse", "auth.unknownError"],
  ])("maps ?error=%s to the message %s", (code, messageKey) => {
    mocks.searchParams = new URLSearchParams(`error=${code}`);
    render(<LoginPage />);
    expect(screen.getByText(messageKey)).toBeInTheDocument();
  });

  it("opens the disabled-account modal for error=access_denied", () => {
    mocks.searchParams = new URLSearchParams("error=access_denied");
    render(<LoginPage />);
    expect(screen.getByText("auth.accountDisabled")).toBeInTheDocument();
    // The inline error message is suppressed while the disabled modal is shown.
    expect(screen.queryByText("auth.unknownError")).not.toBeInTheDocument();
  });

  it("opens the disabled-account modal when error_description contains 'disabled'", () => {
    mocks.searchParams = new URLSearchParams(
      "error=Whatever&error_description=Account is disabled"
    );
    render(<LoginPage />);
    expect(screen.getByText("auth.accountDisabled")).toBeInTheDocument();
  });

  it("redirects to the callbackUrl when already authenticated", () => {
    mocks.auth = { isAuthenticated: true, isLoading: false };
    mocks.searchParams = new URLSearchParams("callbackUrl=/members");
    render(<LoginPage />);
    expect(mocks.push).toHaveBeenCalledWith("/members");
  });

  it("shows the loading spinner while auth is resolving", () => {
    mocks.auth = { isAuthenticated: false, isLoading: true };
    render(<LoginPage />);
    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(
      screen.queryByText("auth.signInWithKeycloak")
    ).not.toBeInTheDocument();
  });

  it("surfaces auth.signInFailed and re-enables the button when signIn throws", async () => {
    mocks.signIn.mockRejectedValueOnce(new Error("network"));
    render(<LoginPage />);
    fireEvent.click(screen.getByText("auth.signInWithKeycloak"));
    expect(await screen.findByText("auth.signInFailed")).toBeInTheDocument();
    // Button is back to its idle label (re-enabled) — isSigningIn was reset.
    expect(screen.getByText("auth.signInWithKeycloak")).toBeInTheDocument();
  });
});

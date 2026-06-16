// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// E30-S2 characterization net: pins the auth-error code→message mapping (currently
// untested) BEFORE the slice extraction. Renders the route entry (`./page`).

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

import AuthErrorPage from "./page";

afterEach(cleanup);

// [code, titleKey, descKey] — the full 11-entry mapping table.
const CASES: Array<[string, string, string]> = [
  [
    "Configuration",
    "authError.configurationError",
    "authError.configurationErrorDesc",
  ],
  ["AccessDenied", "authError.accessDenied", "authError.accessDeniedDesc"],
  [
    "Verification",
    "authError.verificationFailed",
    "authError.verificationFailedDesc",
  ],
  ["OAuthSignin", "authError.signInFailed", "authError.signInFailedDesc"],
  ["OAuthCallback", "authError.callbackError", "authError.callbackErrorDesc"],
  [
    "OAuthCreateAccount",
    "authError.accountCreationFailed",
    "authError.accountCreationFailedDesc",
  ],
  [
    "EmailCreateAccount",
    "authError.accountCreationFailed",
    "authError.accountCreationFailedDesc",
  ],
  ["Callback", "authError.callbackError", "authError.callbackErrorDesc"],
  [
    "OAuthAccountNotLinked",
    "authError.accountNotLinked",
    "authError.accountNotLinkedDesc",
  ],
  ["SessionRequired", "auth.sessionRequired", "auth.sessionRequired"],
  [
    "Default",
    "authError.authenticationError",
    "authError.authenticationErrorDesc",
  ],
];

describe("AuthErrorPage (characterization)", () => {
  it.each(CASES)(
    "error=%s renders its title + description",
    (code, titleKey, descKey) => {
      mocks.searchParams = new URLSearchParams(`error=${code}`);
      const { container } = render(<AuthErrorPage />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        titleKey
      );
      expect(container.querySelector("p.mt-2")).toHaveTextContent(descKey);
    }
  );

  it("falls back to Default when ?error is absent", () => {
    mocks.searchParams = new URLSearchParams();
    const { container } = render(<AuthErrorPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "authError.authenticationError"
    );
    expect(container.querySelector("p.mt-2")).toHaveTextContent(
      "authError.authenticationErrorDesc"
    );
  });

  it("falls back to Default for an unknown error code", () => {
    mocks.searchParams = new URLSearchParams("error=TotallyUnknown");
    render(<AuthErrorPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "authError.authenticationError"
    );
  });

  it("renders the back-to-sign-in and homepage links", () => {
    mocks.searchParams = new URLSearchParams();
    render(<AuthErrorPage />);
    expect(
      screen.getByRole("link", { name: "authError.backToSignIn" })
    ).toHaveAttribute("href", "/login");
    expect(
      screen.getByRole("link", { name: "authError.toHomepage" })
    ).toHaveAttribute("href", "/");
  });
});

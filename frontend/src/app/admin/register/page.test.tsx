// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-086 (E9-S2) AC-1/AC-2: the registration page logo + footer render the
// configured organization, not "IAB Connect" / "Indischer Kulturverein Bern".
//
// E27-S1 characterization tests (regression net) EXTEND this file (DEC-1=A) to
// pin the CURRENT observable behaviour of the page's form at HEAD. No production
// code changed.
//
// REALITY CORRECTION (epic skeleton was WRONG — DEC-3=A):
// `src/app/admin/register/page.tsx` is the PUBLIC self-signup FORM (it POSTs to
// the unauthenticated /api/v1/registration via registerUser), NOT an admin
// approval register. There is NO entries list, NO filters, NO pagination, NO
// approve/reject, NO status badges, and NO admin/auth guard. It is the documented
// PUBLIC exception to the admin-guard rule, so NO admin-guard assertion is made.
//
// A79 deltas: this page uses no TanStack Query and no timers — plain useState +
// a single registerUser() call. `retry:false` masks nothing; there is no
// QueryClientProvider wrapper needed.
//
// A64 / harness note: the existing branding tests use a fresh arrow translator,
// which is fine here because RegisterPage does NOT put `t` in any effect/callback
// dependency chain (no useEffect, no useCallback). We keep the existing mock
// style unchanged for the added tests.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/admin-documents/api/registration", () => ({
  registerUser: vi.fn(),
}));

const customSettings = {
  applicationName: "Acme Verein",
  logoText: "AV",
  logoBackgroundColor: "#123456",
  logoTextColor: "#abcdef",
  description: "desc",
  primaryColor: "#123456",
  publicSiteEnabled: true,
  logoUrl: null,
};
vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: () => ({ settings: customSettings, isLoading: false }),
}));

import RegisterPage from "./page";
import { registerUser } from "@/features/admin-documents/api/registration";

const mockRegisterUser = vi.mocked(registerUser);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Fills all 5 required fields. `password`/`confirm` default to a valid >=8 pair.
function fillForm(
  overrides: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }> = {}
) {
  const v = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    password: "password123",
    confirmPassword: "password123",
    ...overrides,
  };
  fireEvent.change(screen.getByLabelText("registration.firstName *"), {
    target: { value: v.firstName },
  });
  fireEvent.change(screen.getByLabelText("registration.lastName *"), {
    target: { value: v.lastName },
  });
  fireEvent.change(screen.getByLabelText("registration.email *"), {
    target: { value: v.email },
  });
  fireEvent.change(screen.getByLabelText("registration.password *"), {
    target: { value: v.password },
  });
  fireEvent.change(screen.getByLabelText("registration.confirmPassword *"), {
    target: { value: v.confirmPassword },
  });
}

// Submits via the form (the submit button has no accessible role/name we can
// rely on; submitting the form element is the robust path).
function submitForm() {
  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);
}

describe("RegisterPage branding (REQ-086 E9-S2)", () => {
  it("renders the configured org name + logo text, no hardcoded IAB", () => {
    render(<RegisterPage />);

    expect(screen.getByText("Acme Verein")).toBeInTheDocument();
    expect(screen.getByText("AV")).toBeInTheDocument();
    expect(screen.queryByText("IAB Connect")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Indischer Kulturverein Bern")
    ).not.toBeInTheDocument();
  });

  it("renders the org name in the copyright footer", () => {
    render(<RegisterPage />);

    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} Acme Verein`)).toBeInTheDocument();
  });
});

describe("RegisterPage public signup form (E27-S1)", () => {
  it("renders all 5 required fields (firstName/lastName/email/password/confirm)", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText("registration.firstName *")).toBeRequired();
    expect(screen.getByLabelText("registration.lastName *")).toBeRequired();
    expect(screen.getByLabelText("registration.email *")).toBeRequired();
    const password = screen.getByLabelText(
      "registration.password *"
    ) as HTMLInputElement;
    expect(password).toBeRequired();
    // Password has the HTML minLength=8 hint.
    expect(password.minLength).toBe(8);
    expect(password.type).toBe("password");
    expect(
      screen.getByLabelText("registration.confirmPassword *")
    ).toBeRequired();
  });

  it("blocks submit and shows passwordMismatch when passwords differ", () => {
    render(<RegisterPage />);
    fillForm({ password: "password123", confirmPassword: "different123" });
    submitForm();
    expect(
      screen.getByText("registration.passwordMismatch")
    ).toBeInTheDocument();
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it("blocks submit and shows passwordTooShort when password < 8 chars", () => {
    render(<RegisterPage />);
    fillForm({ password: "short", confirmPassword: "short" });
    submitForm();
    expect(
      screen.getByText("registration.passwordTooShort")
    ).toBeInTheDocument();
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it("submits the 4-field payload to registerUser on a valid form", async () => {
    mockRegisterUser.mockResolvedValue({ success: true, message: "ok" });
    render(<RegisterPage />);
    fillForm();
    submitForm();
    await waitFor(() =>
      expect(mockRegisterUser).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
        firstName: "Ada",
        lastName: "Lovelace",
      })
    );
  });

  it("shows the success screen after a successful registration", async () => {
    mockRegisterUser.mockResolvedValue({ success: true, message: "ok" });
    render(<RegisterPage />);
    fillForm();
    submitForm();
    expect(
      await screen.findByText("registration.successTitle")
    ).toBeInTheDocument();
    expect(
      screen.getByText("registration.awaitingApproval")
    ).toBeInTheDocument();
    // The form is gone once the success screen renders.
    expect(
      screen.queryByLabelText("registration.email *")
    ).not.toBeInTheDocument();
  });

  it("maps an 'already exists' error to the registration.emailExists string", async () => {
    mockRegisterUser.mockRejectedValue(
      new Error("A user with that email already exists")
    );
    render(<RegisterPage />);
    fillForm();
    submitForm();
    expect(
      await screen.findByText("registration.emailExists")
    ).toBeInTheDocument();
    // Still on the form (no success screen).
    expect(
      screen.queryByText("registration.successTitle")
    ).not.toBeInTheDocument();
  });

  it("surfaces a generic Error message verbatim when it is not 'already exists'", async () => {
    mockRegisterUser.mockRejectedValue(new Error("server exploded"));
    render(<RegisterPage />);
    fillForm();
    submitForm();
    expect(await screen.findByText("server exploded")).toBeInTheDocument();
  });
});

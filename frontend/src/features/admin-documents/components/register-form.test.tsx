// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { RegisterForm } from "./register-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

function submitForm() {
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
}

function renderForm(onSubmit = vi.fn()) {
  render(
    <RegisterForm
      submitError={null}
      pending={false}
      onSubmit={onSubmit}
      onFieldChange={vi.fn()}
    />
  );
  return onSubmit;
}

describe("RegisterForm (E27-S6 RHF/Zod recipe)", () => {
  it("renders 5 required fields + the password minLength=8 hint", () => {
    renderForm();
    expect(screen.getByLabelText("registration.firstName *")).toBeRequired();
    expect(screen.getByLabelText("registration.lastName *")).toBeRequired();
    expect(screen.getByLabelText("registration.email *")).toBeRequired();
    const password = screen.getByLabelText(
      "registration.password *"
    ) as HTMLInputElement;
    expect(password).toBeRequired();
    expect(password.minLength).toBe(8);
    expect(password.type).toBe("password");
    expect(
      screen.getByLabelText("registration.confirmPassword *")
    ).toBeRequired();
  });

  it("blocks submit + shows passwordMismatch (A96) when passwords differ", () => {
    const onSubmit = renderForm();
    fillForm({ password: "password123", confirmPassword: "different123" });
    submitForm();
    expect(
      screen.getByText("registration.passwordMismatch")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit + shows passwordTooShort when password < 8 chars", () => {
    const onSubmit = renderForm();
    fillForm({ password: "short", confirmPassword: "short" });
    submitForm();
    expect(
      screen.getByText("registration.passwordTooShort")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the 4-field payload (confirmPassword stripped, bytes verbatim — A96)", () => {
    const onSubmit = renderForm();
    fillForm();
    submitForm();
    expect(onSubmit).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "password123",
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });

  it("renders the submit-level error banner when submitError is set", () => {
    render(
      <RegisterForm
        submitError="registration.emailExists"
        pending={false}
        onSubmit={vi.fn()}
        onFieldChange={vi.fn()}
      />
    );
    expect(screen.getByText("registration.emailExists")).toBeInTheDocument();
  });
});

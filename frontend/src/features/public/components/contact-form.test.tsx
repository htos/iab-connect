// SPDX-License-Identifier: AGPL-3.0-or-later
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
import { ContactForm } from "./contact-form";

/**
 * E28-S3 form sub-recipe test (mirrors `sponsor-form.test.tsx`): pins the NEW
 * behaviour the RHF+Zod refactor introduces (the A79 delta) — Zod required-field
 * validation blocks submit (the old HTML5-only form did not under `fireEvent`) and
 * the status-driven label swap / error banner. The S1 page spec covers the
 * honeypot/payload/status-machine end-to-end.
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

afterEach(cleanup);

describe("ContactForm (form sub-recipe)", () => {
  it("renders the error banner and the 'retry' label when status is error", () => {
    render(<ContactForm onSubmit={vi.fn()} status="error" />);
    expect(screen.getByText("errorMessage")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
  });

  it("disables the submit button and shows 'sending' while loading", () => {
    render(<ContactForm onSubmit={vi.fn()} status="loading" />);
    expect(screen.getByRole("button", { name: "sending" })).toBeDisabled();
  });

  it("calls onSubmit with the values (incl. the honeypot website) when valid", async () => {
    const onSubmit = vi.fn();
    render(<ContactForm onSubmit={onSubmit} status="idle" />);

    fireEvent.change(screen.getByLabelText(/nameLabel/), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByLabelText(/emailLabel/), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/subjectLabel/), {
      target: { value: "general" },
    });
    fireEvent.change(screen.getByLabelText(/messageLabel/), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Alice",
          email: "alice@example.com",
          subject: "general",
          message: "Hello",
          website: "",
        }),
        expect.anything()
      )
    );
  });

  it("blocks submit and shows form.required errors when required fields are empty (Zod)", async () => {
    const onSubmit = vi.fn();
    render(<ContactForm onSubmit={onSubmit} status="idle" />);

    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(
      (await screen.findAllByText("form.required")).length
    ).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

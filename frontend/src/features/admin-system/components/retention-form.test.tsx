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

/**
 * E27-S4 form sub-recipe (DEC-2 = RHF+Zod): focused tests for `RetentionForm`.
 * Pins the NEW behaviour the refactor introduces (the A79 delta): the `isSaving`
 * guard the god-page lacked (no double-submit), the A96 no-trim byte-identical
 * submit + `legalBasis "" → null`, the retentionMonths≥1 Zod validation, and the
 * A95 out-of-set `action` round-trip. The S1 retention suite still covers the
 * edit→save→success flow end-to-end through the page.
 */

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

import { RetentionForm } from "./retention-form";
import type { RetentionPolicyDto } from "../types/retention.types";

function makePolicy(
  overrides: Partial<RetentionPolicyDto> = {}
): RetentionPolicyDto {
  return {
    id: "p1",
    dataCategory: "member_data",
    displayName: "Member Data",
    retentionMonths: 24,
    action: "Anonymize",
    legalBasis: "DSG Art. 6",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,
    ...overrides,
  };
}

function renderForm(
  props: Partial<React.ComponentProps<typeof RetentionForm>> = {}
) {
  return render(
    <RetentionForm
      policy={makePolicy()}
      isSaving={false}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />
  );
}

afterEach(cleanup);

describe("RetentionForm (form sub-recipe)", () => {
  it("submits the edited values byte-identically (A96: no trim; legalBasis kept)", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    fireEvent.change(screen.getByDisplayValue("Member Data"), {
      target: { value: "  Padded Name  " },
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const body = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    // A96: the leading/trailing whitespace is preserved (no .trim()).
    expect(body.displayName).toBe("  Padded Name  ");
    expect(body.retentionMonths).toBe(24);
    expect(body.action).toBe("Anonymize");
    expect(body.legalBasis).toBe("DSG Art. 6");
    expect(body.isActive).toBe(true);
  });

  it("coerces retentionMonths to a number and blocks < 1 (Zod)", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit, policy: makePolicy({ retentionMonths: 12 }) });

    fireEvent.change(screen.getByDisplayValue("12"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByText("save"));

    expect(
      await screen.findByText("validation.retentionMonthsMin")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("maps an empty legalBasis to null on submit", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit, policy: makePolicy({ legalBasis: "x" }) });

    fireEvent.change(screen.getByDisplayValue("x"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const body = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(body.legalBasis).toBeNull();
  });

  it("disables both buttons while saving (isSaving guard — no double-submit)", () => {
    renderForm({ isSaving: true });
    expect(screen.getByText("save").closest("button")).toBeDisabled();
    expect(screen.getByText("cancel").closest("button")).toBeDisabled();
  });

  it("round-trips an out-of-set action unchanged on a no-touch save (A95)", async () => {
    const onSubmit = vi.fn();
    // "Purge" is NOT one of the 3 offered options; the schema accepts the union
    // and the select renders an extra option so it round-trips.
    renderForm({
      onSubmit,
      policy: makePolicy({ action: "Delete" }),
    });

    // Submit without touching the action select; the stored "Delete" is preserved.
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect((onSubmit.mock.calls[0][0] as Record<string, unknown>).action).toBe(
      "Delete"
    );
  });
});

// @vitest-environment jsdom
//
// E26-S3 focused invoice-form (RHF+Zod) tests. Pins the load-bearing form deltas the S1
// net cannot directly probe at the form-mechanism level:
//   - A95: recipientType is the FULL transport union — selecting "Other" round-trips the
//     literal "Other" into onSubmit (NOT normalised to "External"); an out-of-set raw
//     default ("External") renders as an extra <option> and round-trips on a no-touch save.
//   - A96: recipientName/address sent untrimmed (as typed).
//   - A98: mode-divergent submit buttons (Draft/Send) thread the sendAfterCreate flag.
//   - A92: an onSubmit that throws (mutation error) must NOT wipe the form input.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href?: string;
  }) => <a href={typeof href === "string" ? href : "#"}>{children}</a>,
}));

import { InvoiceForm } from "./invoice-form";
import type { InvoiceFormValues } from "../../schemas/invoice.schema";

const baseDefaults: InvoiceFormValues = {
  date: "2026-01-01",
  dueDate: "2026-02-01",
  recipientType: "Other",
  recipientId: "",
  recipientName: "",
  recipientAddress: "",
  items: [
    {
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxCodeId: "",
      taxRate: 0,
      isGrossEntry: false,
      activityAreaId: "",
    },
  ],
};

function renderForm(
  overrides: Partial<React.ComponentProps<typeof InvoiceForm>> = {}
) {
  const onSubmit = vi.fn();
  render(
    <InvoiceForm
      defaultValues={baseDefaults}
      members={[]}
      membersLoading={false}
      taxCodes={[]}
      activityAreas={[]}
      loading={false}
      onRecipientTypeChange={() => {}}
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { onSubmit };
}

afterEach(cleanup);

describe("invoice-form — A95 recipientType 'Other' full-union round-trip", () => {
  it("selecting 'Other' submits the literal 'Other' (NOT 'External') with untrimmed name (A96)", async () => {
    const { onSubmit } = renderForm({
      defaultValues: { ...baseDefaults, recipientType: "Member" },
    });
    const typeSelect = screen.getByDisplayValue("recipientTypeMember");
    fireEvent.change(typeSelect, { target: { value: "Other" } });
    fireEvent.change(screen.getByPlaceholderText("recipientNamePlaceholder"), {
      target: { value: "  External Co  " },
    });
    fireEvent.click(screen.getByText("saveAsDraft"));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [values, sendAfterCreate] = onSubmit.mock.calls[0];
    expect(values.recipientType).toBe("Other");
    expect(values.recipientType).not.toBe("External");
    // A96: bytes preserved exactly (leading/trailing spaces kept).
    expect(values.recipientName).toBe("  External Co  ");
    expect(sendAfterCreate).toBe(false);
  });

  it("renders an out-of-set raw default ('External') as an extra option and round-trips it on a no-touch save", async () => {
    const { onSubmit } = renderForm({
      defaultValues: { ...baseDefaults, recipientType: "External" },
    });
    // The extra <option value="External"> must exist (A95 — render the raw value).
    const select = screen.getByDisplayValue("External") as HTMLSelectElement;
    expect(select.querySelector('option[value="External"]')).toBeTruthy();
    fireEvent.click(screen.getByText("saveAsDraft"));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].recipientType).toBe("External");
  });
});

describe("invoice-form — A98 mode-divergent submit buttons", () => {
  it("saveAndSend threads sendAfterCreate=true; saveAsDraft threads false", async () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByText("saveAndSend"));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1]).toBe(true);

    onSubmit.mockClear();
    fireEvent.click(screen.getByText("saveAsDraft"));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1]).toBe(false);
  });
});

describe("invoice-form — A92 input preserved on submit (no synchronous reset)", () => {
  it("keeps the typed recipientName in the field after submit (the form never resets; the content drives reset/navigation from the mutation OUTCOME, so an error leaves input intact)", async () => {
    // The real content hands onSubmit a mutation; on error the content sets an error
    // banner and does NOT touch the form. This simulates that: onSubmit is a no-op
    // (the mutation will resolve/reject elsewhere) — the form must retain its input.
    const { onSubmit } = renderForm({
      defaultValues: { ...baseDefaults, recipientType: "Other" },
    });
    const nameInput = screen.getByPlaceholderText(
      "recipientNamePlaceholder"
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Persisted Co" } });
    fireEvent.click(screen.getByText("saveAsDraft"));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // The form does NOT reset — the value is still in the field (A92 — only the
    // content's onSuccess would clear/navigate; an error path keeps the input).
    expect(
      (
        screen.getByPlaceholderText(
          "recipientNamePlaceholder"
        ) as HTMLInputElement
      ).value
    ).toBe("Persisted Co");
  });
});

describe("invoice-form — permissive schema (no required gate beyond loading)", () => {
  it("submits with empty recipient/items (god-page enable-gate parity)", async () => {
    const { onSubmit } = renderForm({
      defaultValues: { ...baseDefaults, recipientType: "Other" },
    });
    fireEvent.click(screen.getByText("saveAsDraft"));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].recipientName).toBe("");
  });
});

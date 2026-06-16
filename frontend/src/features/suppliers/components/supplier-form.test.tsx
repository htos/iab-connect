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
import { SupplierForm } from "./supplier-form";
import type { SupplierFormValues } from "../schemas/supplier.schema";

/**
 * E22-S4: focused tests for the shared RHF+Zod `SupplierForm` (the E22-S3 form
 * sub-recipe applied to Suppliers). The S4 new/edit characterization suites cover
 * the create/update→redirect + error-banner paths end-to-end; this file pins the
 * Zod required-field validation (the A79 delta the manual form did not enforce).
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const EMPTY: SupplierFormValues = {
  companyName: "",
  contactPerson: "",
  category: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
};

afterEach(cleanup);

describe("SupplierForm (form sub-recipe)", () => {
  it("renders the API error banner when errorMessage is set", () => {
    render(
      <SupplierForm
        defaultValues={EMPTY}
        onSubmit={vi.fn()}
        submitLabel="suppliers.createSupplier"
        pending={false}
        errorMessage="Something went wrong"
      />
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("disables the submit button and shows the saving label while pending", () => {
    render(
      <SupplierForm
        defaultValues={EMPTY}
        onSubmit={vi.fn()}
        submitLabel="suppliers.createSupplier"
        pending={true}
        errorMessage={null}
      />
    );
    expect(
      screen.getByRole("button", { name: "common.saving" })
    ).toBeDisabled();
  });

  it("calls onSubmit with the form values when companyName is provided", async () => {
    const onSubmit = vi.fn();
    render(
      <SupplierForm
        defaultValues={EMPTY}
        onSubmit={onSubmit}
        submitLabel="suppliers.createSupplier"
        pending={false}
        errorMessage={null}
      />
    );

    fireEvent.change(screen.getByLabelText(/suppliers\.companyName/), {
      target: { value: "Acme" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "suppliers.createSupplier" })
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ companyName: "Acme" }),
        expect.anything()
      )
    );
  });

  it("blocks submit and shows a required error when companyName is empty (Zod)", async () => {
    const onSubmit = vi.fn();
    render(
      <SupplierForm
        defaultValues={EMPTY}
        onSubmit={onSubmit}
        submitLabel="suppliers.createSupplier"
        pending={false}
        errorMessage={null}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "suppliers.createSupplier" })
    );

    expect(await screen.findByText("form.required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

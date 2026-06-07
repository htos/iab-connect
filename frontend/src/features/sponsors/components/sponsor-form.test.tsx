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
import { SponsorForm } from "./sponsor-form";
import type { SponsorFormValues } from "../schemas/sponsor.schema";

/**
 * E22-S3 form sub-recipe (DEC-1=A): focused tests for the shared RHF+Zod
 * `SponsorForm`. The S1 new/edit characterization suites already cover the
 * create/update→redirect + error-banner paths end-to-end; this file pins the
 * NEW behaviour the refactor introduces (the A79 delta): Zod required-field
 * validation blocks submit, which the old HTML5-only form did not do under
 * `fireEvent`.
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

const EMPTY: SponsorFormValues = {
  companyName: "",
  contactPerson: "",
  tier: "Bronze",
  email: "",
  phone: "",
  website: "",
  agreementStart: "",
  agreementEnd: "",
  notes: "",
};

afterEach(cleanup);

describe("SponsorForm (form sub-recipe)", () => {
  it("renders the API error banner when errorMessage is set", () => {
    render(
      <SponsorForm
        defaultValues={EMPTY}
        onSubmit={vi.fn()}
        submitLabel="sponsors.createSponsor"
        pending={false}
        errorMessage="Something went wrong"
      />
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("disables the submit button and shows the saving label while pending", () => {
    render(
      <SponsorForm
        defaultValues={EMPTY}
        onSubmit={vi.fn()}
        submitLabel="sponsors.createSponsor"
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
      <SponsorForm
        defaultValues={EMPTY}
        onSubmit={onSubmit}
        submitLabel="sponsors.createSponsor"
        pending={false}
        errorMessage={null}
      />
    );

    fireEvent.change(screen.getByLabelText(/sponsors\.companyName/), {
      target: { value: "Acme" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "sponsors.createSponsor" })
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ companyName: "Acme", tier: "Bronze" }),
        expect.anything()
      )
    );
  });

  it("blocks submit and shows a required error when companyName is empty (Zod)", async () => {
    const onSubmit = vi.fn();
    render(
      <SponsorForm
        defaultValues={EMPTY}
        onSubmit={onSubmit}
        submitLabel="sponsors.createSponsor"
        pending={false}
        errorMessage={null}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "sponsors.createSponsor" })
    );

    expect(await screen.findByText("form.required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

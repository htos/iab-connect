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
import { ProfileForm } from "./profile-form";
import type { ProfileFormValues } from "../schemas/profile.schema";

/**
 * E29-S4 form sub-recipe (DEC-2=A): focused tests for the RHF+Zod `ProfileForm`.
 * The S1 profile characterization suite already covers the load→edit→PUT→exit +
 * error-banner paths end-to-end against the page; this file pins the NEW
 * behaviour the refactor introduces (the A79 delta): Zod required-field
 * validation blocks submit (the old HTML5-only form did not under `fireEvent`),
 * and the optional phone/country never block.
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const FILLED: ProfileFormValues = {
  firstName: "Anna",
  lastName: "Alpha",
  street: "Hauptstrasse 1",
  postalCode: "8000",
  city: "Zürich",
  phone: "",
  country: "",
};

const EMPTY: ProfileFormValues = {
  firstName: "",
  lastName: "",
  street: "",
  postalCode: "",
  city: "",
  phone: "",
  country: "",
};

afterEach(cleanup);

describe("ProfileForm (form sub-recipe)", () => {
  it("disables the submit button and shows the saving label while pending", () => {
    render(
      <ProfileForm
        defaultValues={FILLED}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        pending={true}
      />
    );
    expect(
      screen.getByRole("button", { name: "common.saving" })
    ).toBeDisabled();
  });

  it("marks the five required fields required and phone/country optional", () => {
    render(
      <ProfileForm
        defaultValues={FILLED}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        pending={false}
      />
    );
    expect(
      (screen.getByLabelText("form.firstName *") as HTMLInputElement).required
    ).toBe(true);
    expect(
      (screen.getByLabelText("form.lastName *") as HTMLInputElement).required
    ).toBe(true);
    expect(
      (screen.getByLabelText("form.street *") as HTMLInputElement).required
    ).toBe(true);
    expect(
      (screen.getByLabelText("form.postalCode *") as HTMLInputElement).required
    ).toBe(true);
    expect(
      (screen.getByLabelText("form.city *") as HTMLInputElement).required
    ).toBe(true);
    expect(
      (screen.getByLabelText("form.phone") as HTMLInputElement).required
    ).toBe(false);
    expect(
      (screen.getByLabelText("form.country") as HTMLInputElement).required
    ).toBe(false);
  });

  it("calls onSubmit with the form values when required fields are filled", async () => {
    const onSubmit = vi.fn();
    render(
      <ProfileForm
        defaultValues={FILLED}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        pending={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: "Anna", lastName: "Alpha" }),
        expect.anything()
      )
    );
  });

  it("blocks submit and shows a required error when firstName is empty (Zod)", async () => {
    const onSubmit = vi.fn();
    render(
      <ProfileForm
        defaultValues={EMPTY}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        pending={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(
      (await screen.findAllByText("form.required")).length
    ).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ProfileForm
        defaultValues={FILLED}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        pending={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

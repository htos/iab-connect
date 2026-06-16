// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * E27-S3: behaviour invariants of the RHF+Zod `CustomRoleForm` (DEC-2). Pins A95 (an
 * out-of-set stored `linkedRole` round-trips via an extra `<option>`), A98 (the
 * `isActive` checkbox renders ONLY in edit mode; the title/submit label diverge), and
 * the blank-name submit guard (A96 — value not mutated).
 */

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { CustomRoleForm } from "./custom-role-form";
import type { CustomRoleValues } from "../schemas/custom-role.schema";

const BASE: CustomRoleValues = {
  name: "Editor",
  description: "desc",
  linkedRole: "Member",
  color: "#ea580c",
  sortOrder: 2,
  isActive: true,
};

afterEach(cleanup);

function renderForm(
  props: Partial<React.ComponentProps<typeof CustomRoleForm>> = {}
) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const { container } = render(
    <CustomRoleForm
      mode="edit"
      defaultValues={BASE}
      onSubmit={onSubmit}
      onCancel={onCancel}
      pending={false}
      {...props}
    />
  );
  return { onSubmit, onCancel, container };
}

describe("CustomRoleForm", () => {
  it("renders the isActive checkbox only in edit mode (A98)", () => {
    const { container } = renderForm({ mode: "edit" });
    expect(container.querySelector("#roleIsActive")).toBeInTheDocument();
  });

  it("does NOT render the isActive checkbox in create mode (A98)", () => {
    const { container } = renderForm({
      mode: "create",
      defaultValues: { ...BASE, name: "New" },
    });
    expect(container.querySelector("#roleIsActive")).toBeNull();
  });

  it("round-trips an out-of-set stored linkedRole via an extra option (A95)", async () => {
    const { onSubmit, container } = renderForm({
      defaultValues: { ...BASE, linkedRole: "LegacyTier" },
    });
    const select = container.querySelector("select") as HTMLSelectElement;
    // The widened select carries the canonical 3 PLUS the stored out-of-set value.
    expect(
      within(select).getByRole("option", { name: "LegacyTier" })
    ).toBeInTheDocument();
    expect(select.value).toBe("LegacyTier");

    // Submitting unchanged preserves the stored value (no silent coercion).
    fireEvent.submit(select.closest("form")!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      linkedRole: "LegacyTier",
    });
  });

  it("disables submit when the name is blank (god-page parity, A96 no mutation)", () => {
    renderForm({ mode: "create", defaultValues: { ...BASE, name: "" } });
    // create mode → both the title and the submit button use the createRole key; the
    // submit is the LAST match (title comes first in DOM order).
    const matches = screen.getAllByText("createRole");
    const submit = matches[matches.length - 1].closest("button")!;
    expect(submit).toBeDisabled();
  });
});

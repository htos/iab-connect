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
import { AdminUserForm } from "./admin-user-form";
import type {
  CreateUserFormValues,
  EditUserFormValues,
} from "../schemas/admin-user.schema";

/**
 * E27-S2 form sub-recipe (E22 RHF+Zod): focused tests for the shared
 * `AdminUserForm`. The S1 new/edit nets cover the create/update→redirect/banner
 * paths end-to-end against the route; this file pins the NEW behaviour the
 * refactor introduces (the A79 delta): Zod validation gates submit (A96 — the
 * required messages render as per-field errors), NO `.trim()` mangles the
 * submitted bytes, and the A98 mode-divergent surfaces appear in the right mode.
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const CREATE_EMPTY: CreateUserFormValues = {
  email: "",
  firstName: "",
  lastName: "",
  enabled: true,
  sendInvitation: true,
  temporaryPassword: "",
  roles: ["member"],
};

const EDIT_SEED: EditUserFormValues = {
  email: "seed@user.example",
  firstName: "Anna",
  lastName: "Alpha",
  enabled: true,
  emailVerified: true,
  roles: ["member"],
};

const ROLES = [
  { name: "member", description: "Mitglied" },
  { name: "admin", description: "Administrator" },
];

afterEach(cleanup);

describe("AdminUserForm — create mode", () => {
  it("blocks submit and renders the emailRequired per-field error when email is empty (A96)", async () => {
    const onSubmit = vi.fn();
    render(
      <AdminUserForm
        mode="create"
        defaultValues={CREATE_EMPTY}
        availableRoles={ROLES}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        submitLabel="createUser"
        pending={false}
      />
    );

    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    expect(await screen.findByText("emailRequired")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit with passwordOrInvitationRequired when !sendInvitation and no password", async () => {
    const onSubmit = vi.fn();
    render(
      <AdminUserForm
        mode="create"
        defaultValues={CREATE_EMPTY}
        availableRoles={ROLES}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        submitLabel="createUser"
        pending={false}
      />
    );

    fireEvent.change(screen.getByLabelText("email *"), {
      target: { value: "x@y.example" },
    });
    // uncheck sendInvitation → reveals the temporaryPassword field, leave empty
    fireEvent.click(
      screen.getByRole("checkbox", { name: "sendInvitationEmail" })
    );
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    expect(
      await screen.findByText("passwordOrInvitationRequired")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does NOT trim the submitted byte fields (A96) — raw spaces survive on firstName", async () => {
    // firstName is a plain text input (an <input type="email"> would itself
    // sanitize whitespace, independent of the schema). Spaces surviving here
    // prove the Zod schema applies no `.trim()`/transform on submitted bytes.
    const onSubmit = vi.fn();
    render(
      <AdminUserForm
        mode="create"
        defaultValues={CREATE_EMPTY}
        availableRoles={ROLES}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        submitLabel="createUser"
        pending={false}
      />
    );

    fireEvent.change(screen.getByLabelText("email *"), {
      target: { value: "ok@user.example" },
    });
    fireEvent.change(screen.getByLabelText("firstName"), {
      target: { value: "  Anna  " },
    });
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      firstName: "  Anna  ",
    });
  });

  it("threads the create-only surfaces: invitation block present, no emailVerified (A98)", () => {
    render(
      <AdminUserForm
        mode="create"
        defaultValues={CREATE_EMPTY}
        availableRoles={ROLES}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="createUser"
        pending={false}
      />
    );
    // create-only invitation surface
    expect(
      screen.getByRole("checkbox", { name: "sendInvitationEmail" })
    ).toBeInTheDocument();
    // edit-only surface absent
    expect(
      screen.queryByRole("checkbox", { name: "emailVerified" })
    ).not.toBeInTheDocument();
    // submit label threaded
    expect(
      screen.getByRole("button", { name: "createUser" })
    ).toBeInTheDocument();
  });
});

describe("AdminUserForm — edit mode", () => {
  it("seeds the fields and threads the edit-only surfaces: emailVerified + metadata, no invitation block (A98)", () => {
    render(
      <AdminUserForm
        mode="edit"
        defaultValues={EDIT_SEED}
        availableRoles={ROLES}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="save"
        pending={false}
        userId="user-1"
        createdAt="2024-01-15T10:00:00Z"
      />
    );
    expect(screen.getByLabelText("email *")).toHaveValue("seed@user.example");
    // edit-only emailVerified checkbox, seeded true
    expect(
      screen.getByRole("checkbox", { name: "emailVerified" })
    ).toBeChecked();
    // create-only invitation surface absent
    expect(
      screen.queryByRole("checkbox", { name: "sendInvitationEmail" })
    ).not.toBeInTheDocument();
    // metadata: the user id is shown
    expect(screen.getByText("user-1")).toBeInTheDocument();
  });

  it("calls onSubmit with the seeded values when valid", async () => {
    const onSubmit = vi.fn();
    render(
      <AdminUserForm
        mode="edit"
        defaultValues={EDIT_SEED}
        availableRoles={ROLES}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        submitLabel="save"
        pending={false}
        userId="user-1"
        createdAt={null}
      />
    );

    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      email: "seed@user.example",
      emailVerified: true,
    });
  });

  it("blocks submit with emailRequired when the email is cleared (A96)", async () => {
    const onSubmit = vi.fn();
    render(
      <AdminUserForm
        mode="edit"
        defaultValues={EDIT_SEED}
        availableRoles={ROLES}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        submitLabel="save"
        pending={false}
        userId="user-1"
        createdAt={null}
      />
    );

    fireEvent.change(screen.getByLabelText("email *"), {
      target: { value: "" },
    });
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    expect(await screen.findByText("emailRequired")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

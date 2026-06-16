// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Stable identity translator (returns the key) — mirrors the E27-S1 net style.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { FolderPermissionsDialog } from "./folder-permissions-dialog";
import type { DocumentFolderDto } from "../types/admin-documents.types";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeFolder(
  permissions: { role: string; permissionType: string }[]
): DocumentFolderDto {
  return {
    id: "f1",
    name: "Protocols",
    sortOrder: 0,
    permissions,
    createdAt: "2026-06-01T10:00:00Z",
  };
}

describe("FolderPermissionsDialog", () => {
  it("pre-selects the existing role permissions; Member has no Manage option, Vorstand does", () => {
    render(
      <FolderPermissionsDialog
        folder={makeFolder([
          { role: "Member", permissionType: "Read" },
          { role: "Vorstand", permissionType: "Manage" },
        ])}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const [memberSelect, vorstandSelect] = screen.getAllByRole(
      "combobox"
    ) as HTMLSelectElement[];
    expect(memberSelect.value).toBe("Read");
    expect(vorstandSelect.value).toBe("Manage");
    // Member options are ""/Read/Write (no Manage); Vorstand adds Manage.
    expect(
      within(memberSelect).queryByText("documents.manage")
    ).not.toBeInTheDocument();
    expect(
      within(vorstandSelect).getByText("documents.manage")
    ).toBeInTheDocument();
  });

  it("saves only the non-empty entries (drops a '' = no-access role)", () => {
    const onSave = vi.fn();
    render(
      <FolderPermissionsDialog
        folder={makeFolder([{ role: "Member", permissionType: "Read" }])}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    const vorstandSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(vorstandSelect, { target: { value: "Write" } });
    fireEvent.click(screen.getByText("common.save"));
    expect(onSave).toHaveBeenCalledWith([
      { role: "Member", permissionType: "Read" },
      { role: "Vorstand", permissionType: "Write" },
    ]);
  });

  // A95: a stored permissionType that is NOT in the role's rendered option set
  // must round-trip — rendered as an extra <option> + preserved + re-saved.
  it("round-trips an OUT-OF-SET stored value (A95): renders an extra option, keeps + saves it", () => {
    const onSave = vi.fn();
    render(
      <FolderPermissionsDialog
        folder={makeFolder([
          { role: "Member", permissionType: "Owner" }, // not in ["Read","Write"]
        ])}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    const memberSelect = screen.getAllByRole(
      "combobox"
    )[0] as HTMLSelectElement;
    // The select displays the out-of-set value rather than coercing to "Read".
    expect(memberSelect.value).toBe("Owner");
    // The extra <option> exists with the raw value as its label.
    expect(within(memberSelect).getByText("Owner")).toBeInTheDocument();
    // Saving preserves the out-of-set value verbatim.
    fireEvent.click(screen.getByText("common.save"));
    expect(onSave).toHaveBeenCalledWith([
      { role: "Member", permissionType: "Owner" },
    ]);
  });
});

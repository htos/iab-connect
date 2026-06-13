// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { UserRoleBadge, userRoleClass } from "./user-role-badge";

// A77: the role colour map (admin=red, vorstand=amber per DEC-3, member=green,
// gray fallback for kassier/auditor). vorstand was remapped from the god-page's
// blue to amber to match `custom-role-badge` ("no blue in authenticated UI");
// the E27-S1 list net asserts the role by LABEL, not colour, so this is a free
// deliberate fix. Pins the mapping so any future change stays deliberate. Uses
// the real `getRoleDisplayName` (no next-intl) for the label.

afterEach(cleanup);

describe("userRoleClass", () => {
  it.each([
    ["admin", "bg-red-100 text-red-800"],
    ["vorstand", "bg-amber-100 text-amber-800"],
    ["member", "bg-green-100 text-green-800"],
  ])("maps %s to its colour classes", (role, cls) => {
    expect(userRoleClass(role)).toBe(cls);
  });

  it.each(["kassier", "auditor", "unknown"])(
    "falls back to gray for the unmapped role %s (intentional)",
    (role) => {
      expect(userRoleClass(role)).toBe("bg-gray-100 text-gray-800");
    }
  );

  it("is case-insensitive on the role name", () => {
    expect(userRoleClass("ADMIN")).toBe("bg-red-100 text-red-800");
  });
});

describe("UserRoleBadge", () => {
  it("renders the German display name (admin → Administrator)", () => {
    render(<UserRoleBadge role="admin" />);
    const badge = screen.getByText("Administrator");
    expect(badge).toHaveClass("bg-red-100");
    expect(badge).toHaveClass("text-red-800");
  });

  it("renders the raw role for an unmapped role with a gray badge", () => {
    render(<UserRoleBadge role="kassier" />);
    const badge = screen.getByText("kassier");
    expect(badge).toHaveClass("bg-gray-100");
  });
});

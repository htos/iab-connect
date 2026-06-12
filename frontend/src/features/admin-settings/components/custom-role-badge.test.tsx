// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  ActiveBadge,
  LinkedRoleBadge,
  linkedRoleBadgeClass,
} from "./custom-role-badge";

// DEC-3 (A77): Admin=red + Member=green are pinned by the E27-S1 net; this also pins
// the Vorstand-blue → amber fix and the A95 out-of-set gray fallback.
afterEach(cleanup);

describe("LinkedRoleBadge", () => {
  it("maps Admin onto the verbatim red classes (S1-pinned)", () => {
    render(<LinkedRoleBadge role="Admin" />);
    const badge = screen.getByText("Admin");
    expect(badge).toHaveClass("bg-red-100");
    expect(badge).toHaveClass("text-red-800");
  });

  it("maps Member onto the verbatim green classes (S1-pinned)", () => {
    render(<LinkedRoleBadge role="Member" />);
    const badge = screen.getByText("Member");
    expect(badge).toHaveClass("bg-green-100");
    expect(badge).toHaveClass("text-green-800");
  });

  it("remaps Vorstand off blue onto the amber accent (DEC-3 fix — no blue)", () => {
    render(<LinkedRoleBadge role="Vorstand" />);
    const badge = screen.getByText("Vorstand");
    expect(badge).toHaveClass("bg-amber-100");
    expect(badge).not.toHaveClass("bg-blue-100");
  });

  it("falls back to gray for an out-of-set stored linkedRole (A95)", () => {
    expect(linkedRoleBadgeClass("LegacyTier")).toContain("bg-gray-100");
  });
});

describe("ActiveBadge", () => {
  it("renders the active label with green classes", () => {
    render(
      <ActiveBadge isActive activeLabel="active" inactiveLabel="inactive" />
    );
    const badge = screen.getByText("active");
    expect(badge).toHaveClass("bg-green-100");
    expect(badge).toHaveClass("text-green-800");
  });

  it("renders the inactive label with gray classes", () => {
    render(
      <ActiveBadge
        isActive={false}
        activeLabel="active"
        inactiveLabel="inactive"
      />
    );
    const badge = screen.getByText("inactive");
    expect(badge).toHaveClass("bg-gray-100");
    expect(badge).toHaveClass("text-gray-600");
  });
});

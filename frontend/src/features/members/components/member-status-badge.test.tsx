// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemberStatusBadge } from "./member-status-badge";
import { MembershipStatus } from "../types/member.types";

// S2-DEC-2 (A77): the four status colour classes are copied VERBATIM from the
// god-page getMembershipStatusColor. This test pins that exact mapping (string
// enum + numeric API form + gray fallback) so any future change is deliberate.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

afterEach(cleanup);

describe("MemberStatusBadge", () => {
  it("renders the translated status label", () => {
    render(<MemberStatusBadge status={MembershipStatus.Active} />);
    expect(screen.getByText("status.active")).toBeInTheDocument();
  });

  it.each([
    [MembershipStatus.Pending, "bg-yellow-100", "text-yellow-800"],
    [MembershipStatus.Active, "bg-green-100", "text-green-800"],
    [MembershipStatus.Inactive, "bg-gray-100", "text-gray-800"],
    [MembershipStatus.Suspended, "bg-red-100", "text-red-800"],
  ] as [MembershipStatus, string, string][])(
    "maps the %s string enum onto its verbatim colour classes",
    (status, bg, text) => {
      const key = status.toLowerCase();
      render(<MemberStatusBadge status={status} />);
      const badge = screen.getByText(`status.${key}`);
      expect(badge).toHaveClass(bg);
      expect(badge).toHaveClass(text);
    }
  );

  it.each([
    [0, "pending", "bg-yellow-100"],
    [1, "active", "bg-green-100"],
    [2, "inactive", "bg-gray-100"],
    [3, "suspended", "bg-red-100"],
  ] as [number, string, string][])(
    "maps the numeric API value %i onto its verbatim colour class",
    (numeric, key, bg) => {
      render(<MemberStatusBadge status={numeric} />);
      expect(screen.getByText(`status.${key}`)).toHaveClass(bg);
    }
  );

  it("falls back to gray for an unknown value", () => {
    render(<MemberStatusBadge status="Bogus" />);
    expect(screen.getByText("status.bogus")).toHaveClass("bg-gray-100");
  });

  it("applies the md size classes for the detail card", () => {
    render(<MemberStatusBadge status={MembershipStatus.Active} size="md" />);
    const badge = screen.getByText("status.active");
    expect(badge).toHaveClass("px-3");
    expect(badge).toHaveClass("text-sm");
  });
});

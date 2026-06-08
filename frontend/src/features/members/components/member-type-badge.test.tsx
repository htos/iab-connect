// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemberTypeBadge } from "./member-type-badge";
import { MembershipType } from "../types/member.types";

// S2-DEC-2 (A77): the four membership-type colour classes are copied VERBATIM
// from the god-page getMembershipTypeColor. This test pins the mapping.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

afterEach(cleanup);

describe("MemberTypeBadge", () => {
  it("renders the translated type label", () => {
    render(<MemberTypeBadge type={MembershipType.Regular} />);
    expect(screen.getByText("membershipType.regular")).toBeInTheDocument();
  });

  it.each([
    [MembershipType.Regular, "bg-blue-100", "text-blue-800"],
    [MembershipType.Student, "bg-purple-100", "text-purple-800"],
    [MembershipType.Family, "bg-orange-100", "text-orange-800"],
    [MembershipType.Honorary, "bg-amber-100", "text-amber-800"],
  ] as [MembershipType, string, string][])(
    "maps the %s string enum onto its verbatim colour classes",
    (type, bg, text) => {
      const key = type.toLowerCase();
      render(<MemberTypeBadge type={type} />);
      const badge = screen.getByText(`membershipType.${key}`);
      expect(badge).toHaveClass(bg);
      expect(badge).toHaveClass(text);
    }
  );

  it.each([
    [0, "regular", "bg-blue-100"],
    [1, "student", "bg-purple-100"],
    [2, "family", "bg-orange-100"],
    [3, "honorary", "bg-amber-100"],
  ] as [number, string, string][])(
    "maps the numeric API value %i onto its verbatim colour class",
    (numeric, key, bg) => {
      render(<MemberTypeBadge type={numeric} />);
      expect(screen.getByText(`membershipType.${key}`)).toHaveClass(bg);
    }
  );

  it("falls back to gray for an unknown value", () => {
    render(<MemberTypeBadge type="Bogus" />);
    expect(screen.getByText("membershipType.bogus")).toHaveClass("bg-gray-100");
  });
});

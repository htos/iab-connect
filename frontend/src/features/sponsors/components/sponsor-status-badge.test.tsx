// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SponsorStatusBadge } from "./sponsor-status-badge";
import type { SponsorStatus } from "../types/sponsor.types";

// E22-S2 / DEC-2 (E21-S1): status colours come from the shared Badge primitive's
// token variants — never raw Tailwind colour classes in the feature. Mirrors
// `supplier-status-badge.test.tsx`.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

afterEach(cleanup);

describe("SponsorStatusBadge", () => {
  it("renders the translated status label", () => {
    render(<SponsorStatusBadge status="Active" />);
    expect(screen.getByText("sponsors.status.Active")).toBeInTheDocument();
  });

  it.each([
    ["Active", "bg-primary"],
    ["Prospect", "bg-secondary"],
    ["Paused", "text-foreground"], // outline variant
    ["Ended", "bg-destructive"],
  ] as [SponsorStatus, string][])(
    "maps %s onto the %s token variant",
    (status, expectedClass) => {
      render(<SponsorStatusBadge status={status} />);
      expect(screen.getByText(`sponsors.status.${status}`)).toHaveClass(
        expectedClass
      );
    }
  );
});

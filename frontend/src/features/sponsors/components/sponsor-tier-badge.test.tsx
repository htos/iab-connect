// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SponsorTierBadge } from "./sponsor-tier-badge";
import type { SponsorTier } from "../types/sponsor.types";

// S2-DEC-1 (Option A): tier colour IS the meaning, so the four tier colours live
// in this feature-local badge (NOT mapped onto the generic Badge variants, which
// would mislabel — the A76 class). The colour classes are preserved VERBATIM from
// the original god-page; this test pins that exact mapping so a future change can
// only be deliberate. The label is the raw tier value (not a translation key).

afterEach(cleanup);

describe("SponsorTierBadge", () => {
  it("renders the tier value as the label", () => {
    render(<SponsorTierBadge tier="Gold" />);
    expect(screen.getByText("Gold")).toBeInTheDocument();
  });

  it.each([
    ["Bronze", "bg-amber-100"],
    ["Silver", "bg-gray-200"],
    ["Gold", "bg-yellow-100"],
    ["Platinum", "bg-purple-100"],
  ] as [SponsorTier, string][])(
    "maps %s onto the %s colour class (verbatim from the original page)",
    (tier, expectedClass) => {
      render(<SponsorTierBadge tier={tier} />);
      expect(screen.getByText(tier)).toHaveClass(expectedClass);
    }
  );
});

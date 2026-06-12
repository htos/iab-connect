// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

/**
 * E28-S1 characterization net — public layout shell (`public/layout.tsx`).
 *
 * Pins the shell structure shared by all nine public pages:
 *   div.flex.min-h-screen.flex-col > PublicHeader + main.flex-1.pt-16{children} + PublicFooter
 * The header/footer are REFERENCED (not duplicated) from @/components/navigation/*;
 * they are mocked here as passthrough markers so the shell can be pinned without
 * their provider deps. The `pt-16` offsets the fixed h-16 header — preserve it.
 * S4 consolidates this shell into the slice; this spec stays green unchanged.
 */

import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

vi.mock("@/components/navigation/PublicHeader", () => ({
  default: () => <header data-testid="public-header" />,
}));

vi.mock("@/components/navigation/PublicFooter", () => ({
  default: () => <footer data-testid="public-footer" />,
}));

import PublicLayout from "./layout";

afterEach(cleanup);

describe("PublicLayout shell (E28-S1 characterization)", () => {
  it("renders the header, the children slot inside main, and the footer", () => {
    const { container } = render(
      <PublicLayout>
        <div data-testid="child">Page content</div>
      </PublicLayout>
    );

    expect(screen.getByTestId("public-header")).toBeInTheDocument();
    expect(screen.getByTestId("public-footer")).toBeInTheDocument();

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main).toHaveClass("flex-1", "pt-16");
    expect(main?.querySelector('[data-testid="child"]')).not.toBeNull();
  });

  it("wraps the shell in a flex min-h-screen column", () => {
    const { container } = render(
      <PublicLayout>
        <span>child</span>
      </PublicLayout>
    );
    const root = container.firstElementChild;
    expect(root).toHaveClass("flex", "min-h-screen", "flex-col");
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { Button } from "./button";

// E7-S2 (REQ-056) AC-1: an icon-only button must expose an accessible name. The
// shared Button forwards aria-label via ...props, so passing aria-label at the
// call-site produces an accessible name even when the only child is an icon.

afterEach(cleanup);

describe("Button accessibility", () => {
  it("exposes an accessible name from aria-label for an icon-only button", () => {
    render(
      <Button size="icon" aria-label="Delete row">
        <svg aria-hidden="true" />
      </Button>
    );
    expect(
      screen.getByRole("button", { name: "Delete row" })
    ).toBeInTheDocument();
  });

  it("uses the design-system focus ring token", () => {
    render(<Button aria-label="Save">Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toContain("focus-visible:ring-ring");
  });
});

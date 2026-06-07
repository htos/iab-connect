// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// E7-S2 (REQ-056) AC-1: the dialog close button's accessible name must come from
// a next-intl key, not a hardcoded "Close" string. We mock useTranslations with a
// STABLE function (A64) that maps "close" to a sentinel; if the component were
// hardcoded, the sentinel would not appear.
const translate = (key: string) => (key === "close" ? "SCHLIESSEN_TEST" : key);
vi.mock("next-intl", () => ({
  useTranslations: () => translate,
}));

import { Dialog, DialogContent, DialogTitle } from "./dialog";

afterEach(cleanup);

describe("Dialog accessibility", () => {
  it("renders the close button's accessible name from the i18n key (not a hardcoded string)", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <p>Body</p>
        </DialogContent>
      </Dialog>
    );

    // The Radix close button exposes its sr-only label as the accessible name.
    expect(
      screen.getByRole("button", { name: "SCHLIESSEN_TEST" })
    ).toBeInTheDocument();
    // And the literal hardcoded English string is gone.
    expect(screen.queryByText("Close")).toBeNull();
  });
});

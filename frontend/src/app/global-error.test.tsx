// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// E30-S2 characterization smoke: the ROOT error boundary renders its own
// <html lang="de"><body> with hardcoded bilingual strings (no i18n, no providers)
// and wires reset. It must stay self-contained — no PageShell/next-intl.

import GlobalError from "./global-error";

afterEach(cleanup);

describe("GlobalError boundary (characterization)", () => {
  it("renders the hardcoded bilingual strings, logs the error, and wires retry to reset", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const err = new Error("boom");

    render(<GlobalError error={err} reset={reset} />);

    expect(
      screen.getByText("Etwas ist schiefgelaufen / Something went wrong")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Erneut versuchen / Try again" })
    );
    expect(reset).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(err);

    consoleSpy.mockRestore();
  });
});

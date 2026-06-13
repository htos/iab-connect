// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// E30-S2 characterization smoke: the route error boundary — copy + reset wiring +
// the console.error effect. (Named `ErrorBoundary` to avoid shadowing global Error.)
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

import ErrorBoundary from "./error";

afterEach(cleanup);

describe("Error boundary (characterization)", () => {
  it("renders the error copy, logs the error, and wires retry to reset", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const err = new Error("boom");

    render(<ErrorBoundary error={err} reset={reset} />);

    expect(screen.getByText("error.somethingWentWrong")).toBeInTheDocument();
    expect(screen.getByText("error.unexpectedError")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.tryAgain" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(err);

    consoleSpy.mockRestore();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-087 (E10-S4): next-intl identity translations so assertions can match on the key.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import ModuleUnavailablePage from "./page";

afterEach(cleanup);

describe("ModuleUnavailablePage", () => {
  it("renders the heading, explanation and a back-to-dashboard link", () => {
    render(<ModuleUnavailablePage />);

    expect(
      screen.getByRole("heading", { name: "heading" })
    ).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByText("adminHint")).toBeInTheDocument();

    const back = screen.getByRole("link", { name: "backToDashboard" });
    expect(back).toHaveAttribute("href", "/");
  });

  it("focuses the back-to-dashboard action on load (not a keyboard trap)", () => {
    render(<ModuleUnavailablePage />);

    expect(screen.getByRole("link", { name: "backToDashboard" })).toHaveFocus();
  });
});

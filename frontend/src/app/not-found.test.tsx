// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// E30-S2 characterization smoke: the 404 page is a Server Component with hardcoded
// German copy + a homepage link. No async/server-only API → render-testable directly.

import NotFound from "./not-found";

afterEach(cleanup);

describe("NotFound (characterization)", () => {
  it("renders the German 404 copy and a link to the homepage", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Seite nicht gefunden")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Zur Startseite" })
    ).toHaveAttribute("href", "/");
  });
});

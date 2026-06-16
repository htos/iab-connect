// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// E30-S2 characterization smoke: the route loading.tsx is a Server Component with a
// hardcoded spinner + "Loading..." text. Render-testable directly (no async).

import Loading from "./loading";

afterEach(cleanup);

describe("Loading (characterization)", () => {
  it("renders the spinner and the Loading text", () => {
    const { container } = render(<Loading />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});

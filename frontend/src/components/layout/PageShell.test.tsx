// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { PageShell } from "./PageShell";

afterEach(cleanup);

describe("PageShell", () => {
  it("renders children", () => {
    render(
      <PageShell>
        <p>body content</p>
      </PageShell>
    );
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("carries the canonical frame classes on <main>", () => {
    render(
      <PageShell>
        <p>x</p>
      </PageShell>
    );
    // Pin the exact frame so a future refactor that silently changes it is caught.
    expect(screen.getByRole("main")).toHaveClass(
      "min-h-[calc(100vh-4rem)]",
      "bg-gray-50",
      "p-4",
      "md:p-8"
    );
  });

  it("defaults the container to max-w-7xl", () => {
    render(
      <PageShell>
        <p>x</p>
      </PageShell>
    );
    const inner = screen.getByRole("main").firstElementChild;
    expect(inner).toHaveClass("mx-auto", "max-w-7xl");
  });

  it('applies maxWidth="4xl" as max-w-4xl (proves the static-map path)', () => {
    render(
      <PageShell maxWidth="4xl">
        <p>x</p>
      </PageShell>
    );
    const inner = screen.getByRole("main").firstElementChild;
    expect(inner).toHaveClass("mx-auto", "max-w-4xl");
    expect(inner).not.toHaveClass("max-w-7xl");
  });

  // E30-S5 extended the static map to 2xl/3xl for the retrofit's narrow content frames.
  it.each(["2xl", "3xl", "5xl", "6xl"] as const)(
    'applies maxWidth="%s" as the matching max-w class (static-map path)',
    (width) => {
      render(
        <PageShell maxWidth={width}>
          <p>x</p>
        </PageShell>
      );
      const inner = screen.getByRole("main").firstElementChild;
      expect(inner).toHaveClass("mx-auto", `max-w-${width}`);
      expect(inner).not.toHaveClass("max-w-7xl");
    }
  );

  it("renders the header slot above children when provided", () => {
    render(
      <PageShell header={<div data-testid="hdr">header</div>}>
        <p data-testid="body">body</p>
      </PageShell>
    );
    const inner = screen.getByRole("main").firstElementChild;
    expect(screen.getByTestId("hdr")).toBeInTheDocument();
    expect(screen.getByTestId("body")).toBeInTheDocument();
    // header is rendered before children inside the max-width container.
    expect(inner?.firstElementChild).toHaveAttribute("data-testid", "hdr");
  });

  it("omits the header slot when not provided", () => {
    render(
      <PageShell>
        <p data-testid="body">body</p>
      </PageShell>
    );
    expect(screen.queryByTestId("hdr")).toBeNull();
    const inner = screen.getByRole("main").firstElementChild;
    expect(inner?.firstElementChild).toHaveAttribute("data-testid", "body");
  });
});

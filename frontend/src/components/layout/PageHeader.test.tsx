// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { PageHeader } from "./PageHeader";

afterEach(cleanup);

describe("PageHeader", () => {
  it("renders the title as an <h1> with the canonical classes", () => {
    render(<PageHeader title="My Page" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("My Page");
    expect(h1).toHaveClass(
      "text-2xl",
      "font-bold",
      "text-gray-900",
      "md:text-3xl"
    );
  });

  it("renders the description when provided", () => {
    const { container } = render(
      <PageHeader title="T" description="some description" />
    );
    const p = container.querySelector("p");
    expect(p).not.toBeNull();
    expect(p).toHaveTextContent("some description");
    expect(p).toHaveClass("mt-1", "text-gray-600");
  });

  it("omits the description <p> when not provided", () => {
    const { container } = render(<PageHeader title="T" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders the actions slot when provided", () => {
    render(
      <PageHeader title="T" actions={<button type="button">Create</button>} />
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("omits the actions slot when not provided", () => {
    render(<PageHeader title="T" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { Input } from "./input";

// E7-S2 (REQ-056) AC-2/AC-3: the shared Input must associate its validation
// message programmatically (aria-describedby + aria-invalid) and use the
// design-system focus token rather than the indigo outlier.

afterEach(cleanup);

describe("Input accessibility", () => {
  it("associates the error text via aria-describedby and sets aria-invalid when in error", () => {
    render(<Input label="Email" id="email" error="Required field" />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const errorEl = document.getElementById(describedBy!.split(" ")[0]);
    expect(errorEl).not.toBeNull();
    expect(errorEl).toHaveTextContent("Required field");
  });

  it("omits aria-invalid and aria-describedby when there is no error", () => {
    render(<Input label="Name" id="name" />);

    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("associates the label with the input via htmlFor/id", () => {
    render(<Input label="Phone" id="phone" />);
    expect(screen.getByLabelText("Phone")).toHaveAttribute("id", "phone");
  });

  it("uses the design-system focus ring token, not the indigo outlier", () => {
    render(<Input label="City" id="city" />);
    const input = screen.getByLabelText("City");
    expect(input.className).toContain("focus-visible:ring-ring");
    expect(input.className).not.toContain("indigo");
  });

  it("preserves a caller-supplied aria-describedby and appends the error id", () => {
    render(
      <Input label="Pwd" id="pwd" aria-describedby="hint" error="Too short" />
    );
    const input = screen.getByLabelText("Pwd");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("pwd-error");
    expect(describedBy).toContain("hint");
  });
});

import { describe, expect, it } from "vitest";
import { formatCurrency, formatCHF } from "./utils";

// REQ-022 (E4-S3 / AC-7): formatCurrency accepts an optional currency, defaulting to CHF so every
// existing call site is byte-identical, while fee rendering can pass EUR for white-label parity.
describe("formatCurrency", () => {
  it("defaults to CHF", () => {
    expect(formatCurrency(25)).toContain("CHF");
    expect(formatCurrency(25)).toContain("25");
  });

  it("formats EUR when given", () => {
    const eur = formatCurrency(25, "EUR");
    expect(eur).toContain("EUR");
    expect(eur).toContain("25");
    expect(eur).not.toContain("CHF");
  });

  it("formatCHF alias behaves like formatCurrency default", () => {
    expect(formatCHF(10)).toBe(formatCurrency(10));
  });
});

import { describe, expect, it } from "vitest";
import { buildFeeSchema } from "./fee-category.schema";

/**
 * E24-S3: the fee-category schema mirrors the god-page validator. The translator
 * is an identity echo so each assertion reads back the exact `validation.*` key
 * the message resolves to. Datetime conversion is NOT the schema's job (it runs
 * at submit), so these only cover the field-level rules.
 */
const t = ((key: string) => key) as never;
const schema = buildFeeSchema(t);

const valid = {
  name: "Adult",
  description: "",
  amount: 25,
  currency: "CHF" as const,
  applicability: "Everyone" as const,
  availableFrom: "",
  availableUntil: "",
  maxQuantity: "",
};

describe("buildFeeSchema", () => {
  it("accepts a minimally valid fee category", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("requires a name", () => {
    const result = schema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("validation.nameRequired");
    }
  });

  it("rejects amounts with more than two decimals", () => {
    const result = schema.safeParse({ ...valid, amount: 1.234 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain(
        "validation.amountDecimals"
      );
    }
  });

  it("rejects a negative amount", () => {
    const result = schema.safeParse({ ...valid, amount: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain(
        "validation.amountMin"
      );
    }
  });

  it("rejects an unsupported currency", () => {
    const result = schema.safeParse({ ...valid, currency: "USD" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain(
        "validation.currencyInvalid"
      );
    }
  });

  it("accepts a blank maxQuantity but rejects 0 / non-integer", () => {
    expect(schema.safeParse({ ...valid, maxQuantity: "" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, maxQuantity: "3" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, maxQuantity: "0" }).success).toBe(
      false
    );
    expect(schema.safeParse({ ...valid, maxQuantity: "1.5" }).success).toBe(
      false
    );
  });

  it("requires availableUntil to be after availableFrom", () => {
    const result = schema.safeParse({
      ...valid,
      availableFrom: "2026-06-10T10:00",
      availableUntil: "2026-06-09T10:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("validation.untilAfterFrom");
      expect(result.error.issues[0].path).toEqual(["availableUntil"]);
    }
  });
});

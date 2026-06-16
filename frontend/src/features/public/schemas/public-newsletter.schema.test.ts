// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  publicNewsletterSchema,
  publicUnsubscribeEmailSchema,
} from "./public-newsletter.schema";

/**
 * E28-S3: newsletter schema units. `email` required; `firstName`/`lastName` optional
 * BARE strings (the `|| undefined` coercion that drops empties is at the call site,
 * not in the schema).
 */
describe("publicNewsletterSchema", () => {
  it("accepts email-only (names default to empty)", () => {
    const result = publicNewsletterSchema.safeParse({
      email: "a@b.com",
      firstName: "",
      lastName: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts filled names", () => {
    expect(
      publicNewsletterSchema.safeParse({
        email: "a@b.com",
        firstName: "John",
        lastName: "Doe",
      }).success
    ).toBe(true);
  });

  it("rejects an empty email with form.required", () => {
    const result = publicNewsletterSchema.safeParse({
      email: "",
      firstName: "",
      lastName: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("form.required");
    }
  });
});

describe("publicUnsubscribeEmailSchema", () => {
  it("accepts a filled email", () => {
    expect(
      publicUnsubscribeEmailSchema.safeParse({ email: "a@b.com" }).success
    ).toBe(true);
  });

  it("rejects an empty email with form.required", () => {
    const result = publicUnsubscribeEmailSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("form.required");
    }
  });
});

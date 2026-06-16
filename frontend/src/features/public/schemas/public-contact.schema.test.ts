// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { publicContactSchema } from "./public-contact.schema";

/**
 * E28-S3: contact schema units. Pins the A95/A96 decisions — required fields use
 * `min(1,"form.required")` (NOT `z.enum`, NOT `.trim()`); the honeypot `website` is
 * a bare optional string that survives round-trip untrimmed.
 */
describe("publicContactSchema", () => {
  const valid = {
    name: "Alice",
    email: "alice@example.com",
    subject: "general",
    message: "Hello",
    website: "",
  };

  it("accepts a fully-filled form", () => {
    expect(publicContactSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["name", "email", "subject", "message"] as const)(
    "rejects an empty %s with the form.required message",
    (field) => {
      const result = publicContactSchema.safeParse({ ...valid, [field]: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === field);
        expect(issue?.message).toBe("form.required");
      }
    }
  );

  it("treats subject as required via min(1) — the empty placeholder fails", () => {
    const result = publicContactSchema.safeParse({ ...valid, subject: "" });
    expect(result.success).toBe(false);
  });

  it("accepts any of the 6 subject option values (no z.enum lock — A95)", () => {
    for (const subject of [
      "general",
      "membership",
      "events",
      "sponsoring",
      "other",
    ]) {
      expect(publicContactSchema.safeParse({ ...valid, subject }).success).toBe(
        true
      );
    }
  });

  it("does NOT trim field bytes (A96) — leading/trailing spaces survive", () => {
    const result = publicContactSchema.safeParse({
      ...valid,
      name: "  John  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("  John  ");
  });

  it("allows a filled honeypot website (it stays in the parsed payload)", () => {
    const result = publicContactSchema.safeParse({
      ...valid,
      website: "i-am-a-bot",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.website).toBe("i-am-a-bot");
  });
});

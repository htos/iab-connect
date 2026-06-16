import { describe, expect, it } from "vitest";
import {
  buildShiftSchema,
  utcIsoToZurichLocalInput,
  zurichLocalInputToUtcIso,
} from "./volunteer-shift.schema";

/**
 * E24-S3: the Zurich↔UTC conversion is the regression-critical piece (E24-S1
 * oracle). These pin the round-trip for both DST seasons so the staff form, the
 * table view, and the reminder email stay wall-clock consistent.
 */
describe("zurichLocalInputToUtcIso", () => {
  it("treats summer input as CEST (+2)", () => {
    // 2026-07-01 12:00 Zurich → 10:00:00Z.
    expect(zurichLocalInputToUtcIso("2026-07-01T12:00")).toBe(
      "2026-07-01T10:00:00.000Z"
    );
  });

  it("treats winter input as CET (+1)", () => {
    // 2026-01-15 12:00 Zurich → 11:00:00Z.
    expect(zurichLocalInputToUtcIso("2026-01-15T12:00")).toBe(
      "2026-01-15T11:00:00.000Z"
    );
  });

  it("returns empty string for empty input", () => {
    expect(zurichLocalInputToUtcIso("")).toBe("");
  });
});

describe("utcIsoToZurichLocalInput", () => {
  it("renders UTC as Zurich wall-clock in summer (+2)", () => {
    expect(utcIsoToZurichLocalInput("2026-07-01T10:00:00Z")).toBe(
      "2026-07-01T12:00"
    );
  });

  it("renders UTC as Zurich wall-clock in winter (+1)", () => {
    expect(utcIsoToZurichLocalInput("2026-01-15T11:00:00Z")).toBe(
      "2026-01-15T12:00"
    );
  });
});

describe("buildShiftSchema", () => {
  const t = ((key: string) => key) as never;

  it("rejects a missing title", () => {
    const result = buildShiftSchema(t).safeParse({
      roleId: "r1",
      title: "  ",
      description: "",
      startsAt: "2026-07-01T12:00",
      endsAt: "2026-07-01T14:00",
      capacity: 1,
      allowWaitlist: false,
      allowSelfSignup: false,
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an end that is not after start (error on endsAt)", () => {
    const result = buildShiftSchema(t).safeParse({
      roleId: "r1",
      title: "Shift",
      description: "",
      startsAt: "2026-07-01T14:00",
      endsAt: "2026-07-01T12:00",
      capacity: 1,
      allowWaitlist: false,
      allowSelfSignup: false,
      notes: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "endsAt")).toBe(
        true
      );
    }
  });

  it("accepts a valid shift", () => {
    const result = buildShiftSchema(t).safeParse({
      roleId: "r1",
      title: "Shift",
      description: "",
      startsAt: "2026-07-01T12:00",
      endsAt: "2026-07-01T14:00",
      capacity: 2,
      allowWaitlist: true,
      allowSelfSignup: true,
      notes: "",
    });
    expect(result.success).toBe(true);
  });
});

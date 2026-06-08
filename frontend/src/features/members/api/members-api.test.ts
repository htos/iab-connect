import { describe, expect, it } from "vitest";
import { buildCanonicalPairs } from "./members-api";

/**
 * E23-S3: `buildCanonicalPairs` drives the cascade-dismiss (one POST per pair).
 * The load-bearing invariant is C(N,2) ordered pairs (i<j) — a 3-member group
 * MUST yield exactly 3 pairs so the group disappears in one action.
 */
describe("buildCanonicalPairs", () => {
  it("produces C(3,2) = 3 ordered pairs for 3 ids", () => {
    expect(buildCanonicalPairs(["a", "b", "c"])).toEqual([
      { memberA: "a", memberB: "b" },
      { memberA: "a", memberB: "c" },
      { memberA: "b", memberB: "c" },
    ]);
  });

  it("produces C(2,2) = 1 pair for 2 ids", () => {
    expect(buildCanonicalPairs(["a", "b"])).toEqual([
      { memberA: "a", memberB: "b" },
    ]);
  });

  it("produces 0 pairs for a single id", () => {
    expect(buildCanonicalPairs(["a"])).toEqual([]);
  });

  it("produces 0 pairs for an empty list", () => {
    expect(buildCanonicalPairs([])).toEqual([]);
  });

  it("produces C(4,2) = 6 ordered pairs for 4 ids", () => {
    const pairs = buildCanonicalPairs(["a", "b", "c", "d"]);
    expect(pairs).toHaveLength(6);
    expect(pairs).toEqual([
      { memberA: "a", memberB: "b" },
      { memberA: "a", memberB: "c" },
      { memberA: "a", memberB: "d" },
      { memberA: "b", memberB: "c" },
      { memberA: "b", memberB: "d" },
      { memberA: "c", memberB: "d" },
    ]);
  });
});

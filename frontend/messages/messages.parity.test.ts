// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * REQ-055 (E7-S3 AC-1/AC-3): global message-file parity guards.
 *
 *  - de.json and en.json MUST have an IDENTICAL key set. No such global guard
 *    existed before E7-S3 (only scoped per-namespace parity tests for the beta
 *    and automations namespaces), and the spike found a real drift:
 *    `events.edit.editEvent` was in de.json only.
 *    E7-S3 fixed it and this test prevents regression.
 *  - hi.json (the incremental Hindi seed) may be a SUBSET of en.json during
 *    translation, but MUST NOT contain stray keys absent from en.json — every
 *    Hindi key must map onto a real English key so the deep-merge fallback works.
 *
 * Pure-Node (file read + key-set assertions, no render) per A46.
 */

type Json = Record<string, unknown>;

function loadJson(relPath: string): Json {
  return JSON.parse(readFileSync(resolve(process.cwd(), relPath), "utf8"));
}

function flattenKeys(obj: Json, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const nested of flattenKeys(v as Json, path)) keys.add(nested);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

describe("message-file parity (E7-S3)", () => {
  const en = flattenKeys(loadJson("messages/en.json"));
  const de = flattenKeys(loadJson("messages/de.json"));
  const hi = flattenKeys(loadJson("messages/hi.json"));

  it("de.json and en.json have an identical key set", () => {
    const inDeNotEn = [...de].filter((k) => !en.has(k)).sort();
    const inEnNotDe = [...en].filter((k) => !de.has(k)).sort();
    expect(inDeNotEn, "keys in de.json missing from en.json").toEqual([]);
    expect(inEnNotDe, "keys in en.json missing from de.json").toEqual([]);
  });

  it("hi.json contains no keys absent from en.json (may be a subset, never a superset)", () => {
    const strayHiKeys = [...hi].filter((k) => !en.has(k)).sort();
    expect(strayHiKeys, "keys in hi.json with no English counterpart").toEqual(
      []
    );
  });

  it("hi.json carries at least the seeded core (language + common.close + nav.dashboard)", () => {
    expect(hi.has("language.hi")).toBe(true);
    expect(hi.has("common.close")).toBe(true);
    expect(hi.has("nav.dashboard")).toBe(true);
  });
});

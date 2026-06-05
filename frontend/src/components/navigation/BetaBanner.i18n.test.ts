// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * REQ-088 AC-7 (E18-S3 AC-3 + AC-5): direct-artifact-read regression guards
 * for the BETA banner's spec invariants (A51 — read the source-of-truth files,
 * not a render). Pure-Node (no jsdom, no cleanup) per A46 — this file only
 * reads JSON/TSX text and asserts string contracts.
 *
 * Two invariants:
 *  (AC-3) The German banner text the AC mandates verbatim
 *         — "Beta — Daten können jederzeit zurückgesetzt werden" —
 *         lives in messages/de.json under `beta.bannerMessage`, and the `beta`
 *         key set is mirrored in en.json (locale completeness). The shipped
 *         banner renders this via `t("bannerMessage")`, so a translation edit
 *         that drifts from the spec string fails here at test time rather than
 *         shipping a non-compliant banner.
 *  (AC-5) The banner is mounted in the App Router root layout — a future layout
 *         refactor that drops `<BetaBanner />` (or moves the component) fails
 *         this code-audit.
 */

// The exact German string mandated by SCP-2026-05-15 §5 E18-S3 / epics E18-S3.
// Em-dash (U+2014) + umlauts are part of the contract — assert byte-for-byte.
const AC_MANDATED_DE_BANNER =
  "Beta — Daten können jederzeit zurückgesetzt werden";

// The `beta` namespace keys the component reads via useTranslations("beta").
const BETA_KEYS = [
  "bannerMessage",
  "feedbackLink",
  "dismissAriaLabel",
  "ariaLabel",
] as const;

function loadJson(relPath: string): Record<string, unknown> {
  // Vitest runs with cwd = frontend/.
  const path = resolve(process.cwd(), relPath);
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadText(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("BetaBanner i18n + layout invariants (E18-S3)", () => {
  const de = loadJson("messages/de.json");
  const en = loadJson("messages/en.json");
  const deBeta = de.beta as Record<string, string> | undefined;
  const enBeta = en.beta as Record<string, string> | undefined;

  it("de.json beta.bannerMessage equals the AC-mandated German string byte-for-byte (AC-3)", () => {
    expect(deBeta).toBeDefined();
    expect(deBeta!.bannerMessage).toBe(AC_MANDATED_DE_BANNER);
  });

  it("en.json carries the parallel beta.bannerMessage key (locale completeness, AC-3)", () => {
    expect(enBeta).toBeDefined();
    expect(typeof enBeta!.bannerMessage).toBe("string");
    expect(enBeta!.bannerMessage.length).toBeGreaterThan(0);
  });

  it("de.json and en.json define the identical beta key set the component reads (AC-3)", () => {
    expect(deBeta).toBeDefined();
    expect(enBeta).toBeDefined();
    for (const key of BETA_KEYS) {
      expect(deBeta, `de.json beta.${key}`).toHaveProperty(key);
      expect(enBeta, `en.json beta.${key}`).toHaveProperty(key);
    }
  });

  it("root layout imports BetaBanner from the navigation path and mounts it (AC-5)", () => {
    const layout = loadText("src/app/layout.tsx");
    expect(layout).toMatch(
      /import\s*\{[^}]*\bBetaBanner\b[^}]*\}\s*from\s*["'][^"']*navigation\/BetaBanner["']/
    );
    expect(layout).toMatch(/<BetaBanner\b/);
  });
});

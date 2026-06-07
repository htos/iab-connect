// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * REQ-055 (E7-S3 AC-2): the `locales` array is duplicated in two source-of-truth
 * files — src/i18n/request.ts (server) and src/i18n/index.ts (client re-export).
 * They MUST stay byte-equal or a locale can be loadable on one side and unknown on
 * the other. This is a direct-artifact-read lockstep guard (A51): it parses the
 * actual `locales = [...]` literal out of both files and asserts they match.
 * Pure-Node (no jsdom, no cleanup) per A46.
 */

function readLocalesArray(relPath: string): string[] {
  const text = readFileSync(resolve(process.cwd(), relPath), "utf8");
  const match = text.match(/locales\s*=\s*\[([^\]]*)\]/);
  if (!match) {
    throw new Error(`Could not find a 'locales = [...]' literal in ${relPath}`);
  }
  return match[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => s.length > 0);
}

describe("i18n locale-list lockstep (E7-S3)", () => {
  it("request.ts and index.ts declare the identical locales array", () => {
    const requestLocales = readLocalesArray("src/i18n/request.ts");
    const indexLocales = readLocalesArray("src/i18n/index.ts");
    expect(requestLocales).toEqual(indexLocales);
  });

  it("the locale list includes en, de, and hi", () => {
    const requestLocales = readLocalesArray("src/i18n/request.ts");
    expect(requestLocales).toEqual(["en", "de", "hi"]);
  });
});

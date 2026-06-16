// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * REQ-088 AC-10 (E18-S4 AC-3): A31 direct-artifact-read parity guard for the
 * Beta feedback channel. Pure-Node (no jsdom, no cleanup) per A46.
 *
 * The shipped BetaBanner builds its feedback URL as
 *   `${sourceUrl}/issues/new?template=beta-feedback.md`
 * GitHub resolves `?template=<name>` to a CLASSIC issue template of that exact
 * filename under `.github/ISSUE_TEMPLATE/`. If either side is renamed without
 * the other, the link silently lands on a blank issue (the `?template=` param
 * is dead). This test reads BOTH source-of-truth files and asserts they agree,
 * so the drift fails at test time rather than in a tester's browser.
 *
 * Note on paths: Vitest runs with cwd = frontend/. The banner is under
 * frontend/src/...; the issue template is at the REPO ROOT (one level up).
 */

function repoRoot(rel: string): string {
  return resolve(process.cwd(), "..", rel);
}

function frontend(rel: string): string {
  return resolve(process.cwd(), rel);
}

describe("Beta feedback channel: banner URL ↔ issue template parity (E18-S4)", () => {
  const banner = readFileSync(
    frontend("src/components/navigation/BetaBanner.tsx"),
    "utf8"
  );

  it("BetaBanner constructs a ?template=<file>.md feedback URL", () => {
    const match = banner.match(/template=([A-Za-z0-9._-]+\.md)/);
    expect(
      match,
      "BetaBanner.tsx must build a ?template=<name>.md URL"
    ).not.toBeNull();
    expect(match![1]).toBe("beta-feedback.md");
  });

  it("the referenced classic issue template file exists at the repo root", () => {
    const match = banner.match(/template=([A-Za-z0-9._-]+\.md)/);
    const templateName = match![1];
    const templatePath = repoRoot(`.github/ISSUE_TEMPLATE/${templateName}`);
    expect(
      existsSync(templatePath),
      `expected ${templateName} to exist under .github/ISSUE_TEMPLATE/`
    ).toBe(true);
  });

  it("the issue template carries the required classic-template frontmatter", () => {
    const template = readFileSync(
      repoRoot(".github/ISSUE_TEMPLATE/beta-feedback.md"),
      "utf8"
    );
    // Classic GitHub issue templates need a YAML frontmatter block with at
    // least name + about; we also lock the beta-feedback label + title prefix.
    expect(template).toMatch(/^---\r?\n[\s\S]*?\r?\n---/);
    expect(template).toMatch(/^name:\s*\S+/m);
    expect(template).toMatch(/^about:\s*\S+/m);
    expect(template).toMatch(/^labels:\s*beta-feedback\s*$/m);
    expect(template).toMatch(/^title:\s*".*Beta-Feedback.*"/m);
  });
});

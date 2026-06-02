// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * REQ-088 AC-7 (E16-S1 AC-5): regression guard for the `frontend/Dockerfile`
 * NEXT_PUBLIC_* ARG-and-ENV bridge.
 *
 * Background: each `NEXT_PUBLIC_*` build-arg MUST be declared as BOTH
 *   `ARG  <name>`              and
 *   `ENV  <name>=$<name>`
 * The ARG accepts `--build-arg` input from CI; the ENV exposes the value to
 * the Node process running `next build`. Without the ENV bridge,
 * `process.env.NEXT_PUBLIC_*` is undefined at build time and Next.js
 * silently inlines empty strings into the static client bundle — the symptom
 * appears only on first browser login (404 on OIDC discovery) or first
 * thumbnail render (broken image). This test catches a future edit that
 * drops one half of the bridge.
 *
 * Plus: regression-guards the fail-fast `test -n` guard that REQUIRES the
 * five OIDC-critical vars (API_URL + 4 KEYCLOAK_*). Dropping a name from
 * the guard re-introduces the silent-empty-string failure mode.
 */

const REQUIRED_PUBLIC_VARS = [
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_KEYCLOAK_URL",
  "NEXT_PUBLIC_KEYCLOAK_REALM",
  "NEXT_PUBLIC_KEYCLOAK_CLIENT_ID",
  "NEXT_PUBLIC_KEYCLOAK_ISSUER",
] as const;

const OPTIONAL_PUBLIC_VARS = [
  "NEXT_PUBLIC_ENV_LABEL",
  "NEXT_PUBLIC_DOCUMENT_HOST",
  "NEXT_PUBLIC_SOURCE_URL",
  "NEXT_PUBLIC_FEEDBACK_URL",
] as const;

const ALL_PUBLIC_VARS = [...REQUIRED_PUBLIC_VARS, ...OPTIONAL_PUBLIC_VARS];

function loadDockerfile(): string {
  // Vitest runs with cwd = frontend/; Dockerfile is at frontend/Dockerfile.
  const path = resolve(process.cwd(), "Dockerfile");
  return readFileSync(path, "utf8");
}

describe("frontend/Dockerfile NEXT_PUBLIC_* ARG/ENV bridge contract", () => {
  const dockerfile = loadDockerfile();

  for (const name of ALL_PUBLIC_VARS) {
    it(`declares ARG ${name} in the build stage`, () => {
      const argPattern = new RegExp(`^ARG\\s+${name}(=.*)?$`, "m");
      expect(dockerfile).toMatch(argPattern);
    });

    it(`bridges ENV ${name}=$${name} in the build stage`, () => {
      // Multi-line ENV uses line continuations; match either standalone or
      // backslash-continued form.
      const envPattern = new RegExp(
        `\\b${name}=\\$${name}(\\b|\\s|$)`,
        "m"
      );
      expect(dockerfile).toMatch(envPattern);
    });
  }

  it("fail-fast guard requires all 5 OIDC-critical vars", () => {
    // The `RUN test -n "$VAR"` chain must reference every required var.
    // We assert each required var name appears inside the guard block.
    const guardMatch = dockerfile.match(
      /RUN\s+test\s+-n\s+"\$NEXT_PUBLIC_[\s\S]+?--build-arg\."[\s\S]+?exit 1\)/
    );
    expect(guardMatch).not.toBeNull();
    const guardBlock = guardMatch![0];
    for (const name of REQUIRED_PUBLIC_VARS) {
      expect(guardBlock).toContain(`-n "$${name}"`);
    }
  });

  it("does NOT include any optional var in the fail-fast guard", () => {
    // The four optional vars (ENV_LABEL/DOCUMENT_HOST/SOURCE_URL/FEEDBACK_URL)
    // have Dockerfile defaults and intentionally fall through if unset.
    // Adding them to the guard would break dev / fork builds that don't
    // override those four.
    const guardMatch = dockerfile.match(
      /RUN\s+test\s+-n\s+"\$NEXT_PUBLIC_[\s\S]+?exit 1\)/
    );
    expect(guardMatch).not.toBeNull();
    const guardBlock = guardMatch![0];
    for (const name of OPTIONAL_PUBLIC_VARS) {
      expect(guardBlock).not.toContain(`-n "$${name}"`);
    }
  });
});

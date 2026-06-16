// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * REQ-088 AC-4 (E14-S2): builds the Content-Security-Policy header value emitted by
 * Next.js for every route. Practical-enforcing profile per E14-S2 DEC-1=A: locks
 * connect-src + frame-src + form-action to the api + Keycloak public origins while
 * permitting the inline-script + inline-style patterns Next.js 16 + React 19 +
 * next-intl + NextAuth require. The connect-src restriction is the highest-value
 * directive — script injection cannot exfiltrate to attacker-controlled origins even
 * if 'unsafe-inline' is permitted.
 *
 * The function reads `process.env.NEXT_PUBLIC_*` at next-config evaluation time
 * (build-time-baked). Forks override the values via build-arg / GHA repo variable.
 *
 * Rationale per directive — see docs/14_beta_railway_setup.md Section 21.4.
 */
export interface CspBuildEnv {
  readonly NEXT_PUBLIC_API_URL?: string;
  readonly NEXT_PUBLIC_KEYCLOAK_URL?: string;
  readonly NEXT_PUBLIC_DOCUMENT_HOST?: string;
  // Index signature lets the function accept NodeJS.ProcessEnv directly
  // (process.env is typed as a Record<string, string | undefined>; without
  // this signature TypeScript reports "no properties in common").
  readonly [key: string]: string | undefined;
}

const DEFAULTS = {
  API: "http://localhost:5000",
  KEYCLOAK: "http://localhost:8080",
  DOCUMENT_HOST: "localhost:9000",
} as const;

/**
 * Edge-11: protect against CSP directive injection via env vars. A malicious value like
 * `https://api.example.com; script-src https://evil.com` would inject an extra directive
 * when concatenated raw. We parse via `new URL()` and emit only the origin (`scheme://host[:port]`).
 * Falls back to the default if the env value is not a valid absolute URL.
 */
function normalizeOrigin(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;
  // Reject any control char or whitespace or CSP-meaningful separator.
  if (/[;\s'"`<>]/.test(raw)) return fallback;
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return fallback;
  }
}

/**
 * `img-src` host-source: accepts `host[:port]` without scheme. We allow that shape but
 * reject control chars + CSP separators to prevent injection.
 */
function normalizeHostSource(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;
  if (/[;\s'"`<>]/.test(raw)) return fallback;
  // Accept either a bare host[:port] or a full URL (extract host).
  try {
    const url = new URL(raw);
    return url.host;
  } catch {
    // Treat as host[:port] — validate via permissive char set.
    return /^[a-zA-Z0-9.\-:_*]+$/.test(raw) ? raw : fallback;
  }
}

export function buildContentSecurityPolicy(env: CspBuildEnv): string {
  const apiOrigin = normalizeOrigin(env.NEXT_PUBLIC_API_URL, DEFAULTS.API);
  const keycloakOrigin = normalizeOrigin(env.NEXT_PUBLIC_KEYCLOAK_URL, DEFAULTS.KEYCLOAK);
  const documentHost = normalizeHostSource(env.NEXT_PUBLIC_DOCUMENT_HOST, DEFAULTS.DOCUMENT_HOST);

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${documentHost}`,
    `font-src 'self' data:`,
    `connect-src 'self' ${apiOrigin} ${keycloakOrigin}`,
    `frame-src ${keycloakOrigin}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self' ${keycloakOrigin}`,
  ];

  return directives.join("; ");
}

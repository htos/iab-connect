import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { getRemotePatternFromEnv } from "./src/lib/config/document-host";
import { buildContentSecurityPolicy } from "./src/lib/config/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Turbopack is stable in Next.js 16
  // Use `next dev --turbopack` for development

  // Standalone output for the E12-S2 Frontend Dockerfile: emits .next/standalone/server.js
  // (self-contained Node entrypoint) so the runtime image does not need `npm ci` at boot.
  output: "standalone",

  // Pin the trace root to this directory (frontend/). Without this, Next.js infers a
  // workspace root from the nearest parent lockfile, which on monorepo-like layouts
  // produces `.next/standalone/<parent>/<project>/server.js` instead of the expected
  // `.next/standalone/server.js`. E12-S2 Dockerfile COPYs the flat shape.
  outputFileTracingRoot: path.join(__dirname),

  // Strict mode for better React practices
  reactStrictMode: true,

  // NEXT_PUBLIC_API_URL is build-time-constant (Next.js bakes NEXT_PUBLIC_* into the
  // static client bundle at `next build` time). Any API-URL change requires a rebuild.
  // Documented in frontend/.env.example. Default dev fallback below.
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
    // REQ-089 AC-4 (E20-S4): default source URL for the license footer; override at
    // deploy time for forks. Mirrored as ARG default at `frontend/Dockerfile:56` and as
    // documentation in `frontend/.env.example:64`.
    NEXT_PUBLIC_SOURCE_URL:
      process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/htos/iab-connect",
  },

  // Image host allowlist for next/image. Computed from NEXT_PUBLIC_DOCUMENT_HOST at
  // build time, with a localhost:9000 fallback for dev. See src/lib/config/document-host.ts.
  images: {
    remotePatterns: [
      getRemotePatternFromEnv(process.env.NEXT_PUBLIC_DOCUMENT_HOST),
    ],
  },

  // Headers for security. The 3 mirror-able headers match backend
  // DependencyInjection.cs:269-277 byte-for-byte (E14-S2 A31 invariant). The CSP
  // (E14-S2 AC-4 / DEC-1=A Practical-enforcing) locks connect-src + frame-src to the
  // api + Keycloak public origins while permitting the inline-script + inline-style
  // patterns Next.js 16 + React 19 require. See docs/14_beta_railway_setup.md §21.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy(process.env),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

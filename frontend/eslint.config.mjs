import nextConfig from "eslint-config-next";

// E21-S5: architecture boundary enforcement for the feature-slice direction
// (E21-S1 "Target Import Direction"). Static import rules via ESLint core
// `no-restricted-imports`, scoped per zone. These are STATIC architecture
// boundaries — distinct from `e2e/module-enforcement.spec.ts`, which is a
// runtime E2E behaviour test for module enablement (see docs/architecture-frontend.md).
// Cross-zone imports use the `@/` alias by convention; a legitimate exception
// needs an explicit `// eslint-disable-next-line no-restricted-imports` with a reason.

// E31-S2: the legacy `@/lib` HTTP-client layer (the class-based `ApiClient`, the
// per-resource `@/lib/api/*` token-fn modules, the `@/lib/services/*` ApiResult
// services, and `@/lib/email-templates`) was RETIRED — every transport now lives
// in its owning `features/<domain>/api` slice (or a shared `@/types/*` home).
// This ban makes the single-contract end-state permanent: a future re-creation of
// any legacy path fails lint. NOTE: `@/lib/auth`, `@/lib/modules`, `@/lib/utils`
// are LIVE infrastructure and are deliberately NOT banned.
const legacyHttpClientBan = {
  group: [
    "@/lib/api-client",
    "@/lib/email-templates",
    "@/lib/api/*",
    "@/lib/services/*",
  ],
  message:
    "The legacy @/lib HTTP clients were retired in E31. Import the transport from its owning `features/<domain>/api` slice (or the relocated type from its `@/types/*` home).",
};

const boundaryRules = [
  {
    // components/ui is a leaf primitive layer: must not import features or app.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features", "@/features/**", "@/app", "@/app/**"],
              message:
                "components/ui is a leaf primitive layer and must not import from features or app (E21 boundary).",
            },
            legacyHttpClientBan,
          ],
        },
      ],
    },
  },
  {
    // components/layout is a shared presentational layer (PageShell/PageHeader,
    // E30-S1): a true leaf like components/ui — must not import features or app.
    files: ["src/components/layout/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features", "@/features/**", "@/app", "@/app/**"],
              message:
                "components/layout is a shared presentational layer and must not import from features or app (E21 boundary).",
            },
            legacyHttpClientBan,
          ],
        },
      ],
    },
  },
  {
    // lib is leaf infrastructure: must not import from app or features.
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app", "@/app/**", "@/features", "@/features/**"],
              message:
                "lib is leaf infrastructure and must not import from app or features (E21 boundary).",
            },
            legacyHttpClientBan,
          ],
        },
      ],
    },
  },
  {
    // A feature must not deep-couple to another feature. Use relative imports
    // within a feature; cross-feature coupling needs explicit justification.
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features", "@/features/**"],
              message:
                "A feature must not import another feature via the @/features alias (E21 boundary). Use relative imports within a feature; cross-feature coupling needs an explicit eslint-disable with a reason.",
            },
            legacyHttpClientBan,
          ],
        },
      ],
    },
  },
  {
    // Everything else (app/, types/, hooks/, middleware, …) — the zones above own
    // their own no-restricted-imports rule, so this catch-all EXCLUDES them to
    // avoid clobbering (flat-config last-match wins per rule). It enforces only the
    // E31 legacy-path ban repo-wide.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/components/ui/**",
      "src/components/layout/**",
      "src/lib/**",
      "src/features/**",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [legacyHttpClientBan] }],
    },
  },
];

const config = [
  ...nextConfig,
  ...boundaryRules,
  {
    ignores: ["node_modules/", ".next/"],
  },
];

export default config;

import nextConfig from "eslint-config-next";

// E21-S5: architecture boundary enforcement for the feature-slice direction
// (E21-S1 "Target Import Direction"). Static import rules via ESLint core
// `no-restricted-imports`, scoped per zone. These are STATIC architecture
// boundaries — distinct from `e2e/module-enforcement.spec.ts`, which is a
// runtime E2E behaviour test for module enablement (see docs/architecture-frontend.md).
// Cross-zone imports use the `@/` alias by convention; a legitimate exception
// needs an explicit `// eslint-disable-next-line no-restricted-imports` with a reason.
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
          ],
        },
      ],
    },
  },
];

export default [
  ...nextConfig,
  ...boundaryRules,
  {
    ignores: ["node_modules/", ".next/"],
  },
];

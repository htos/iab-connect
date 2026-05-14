/**
 * REQ-087 (E10-S4): shared frontend module contract — the single source of truth for the
 * module keys and the module → route-prefix mapping. Referenced by both `middleware.ts`
 * (the direct-URL route guard) and `Sidebar` (nav filtering) so the mapping is never
 * duplicated.
 *
 * ADR-008 layers 2 & 3: navigation hiding and route rewriting are UX / direct-URL
 * convenience only — the backend 403 from E10-S3 is the real security boundary.
 */

/** Canonical module keys — must match the backend `ModuleKeys` constants. */
export const MODULE_KEYS = [
  "members",
  "events",
  "documents",
  "communication",
  "finance",
  "partners",
  "public_view",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Module keys that gate authenticated app routes (everything except `public_view`). */
export type GatedModuleKey = Exclude<ModuleKey, "public_view">;

/**
 * Module → gated route prefixes. A request path that equals or is nested under one of
 * these prefixes belongs to that module. `public_view` is intentionally absent — public
 * site gating is handled separately in E10-S5.
 */
export const MODULE_ROUTE_PREFIXES: Record<GatedModuleKey, string[]> = {
  members: ["/members"],
  events: ["/events"],
  documents: ["/documents", "/board/documents", "/admin/documents"],
  communication: ["/communication"],
  finance: ["/finance"],
  partners: ["/sponsors", "/suppliers"],
};

/**
 * Resolve a request pathname to the module that owns it, or `null` if the path is not
 * module-gated. Longest matching prefix wins, so `/admin/documents` resolves to
 * `documents` rather than leaking into the never-gated rest of `/admin`.
 */
export function resolveModuleForPath(pathname: string): GatedModuleKey | null {
  let match: { module: GatedModuleKey; length: number } | null = null;

  for (const [moduleKey, prefixes] of Object.entries(MODULE_ROUTE_PREFIXES) as [
    GatedModuleKey,
    string[],
  ][]) {
    for (const prefix of prefixes) {
      if (pathname === prefix || pathname.startsWith(prefix + "/")) {
        if (!match || prefix.length > match.length) {
          match = { module: moduleKey, length: prefix.length };
        }
      }
    }
  }

  return match?.module ?? null;
}

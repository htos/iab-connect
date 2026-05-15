/**
 * REQ-087 (E10-S4 + E10-S5): direct-URL route guard — ADR-008 layer 2.
 *
 * E10-S4: rewrites direct navigation to a disabled-module route to `/module-unavailable`.
 * E10-S5: when the `public_view` module is disabled, rewrites `/public/*` and the
 * unauthenticated landing `/` to a neutral `/site-unavailable` page.
 *
 * This is UX / direct-URL convenience only — the backend 403 (E10-S3) and the
 * `RequireModule` endpoint filter (E10-S5) are the real security boundary; a disabled
 * module's API calls still 403 regardless of this middleware.
 *
 * The module map is read from the anonymous `GET /api/v1/settings/public` (E10-S2 exposes
 * it there precisely so the Edge middleware has an unauthenticated source) and cached
 * in-memory for a short window to avoid a fetch per request.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveModuleForPath, sanitizeModuleMap } from "@/lib/modules";

// Next.js matchers cannot be fully dynamic — list the gated prefixes broadly here, then
// branch precisely in middleware(). `:path*` matches the bare prefix as well as nested
// paths. `/admin/documents` is matched without gating the rest of `/admin` (Q2). `/` and
// `/public/*` are matched for the E10-S5 Public View gate.
export const config = {
  matcher: [
    "/",
    "/public/:path*",
    "/members/:path*",
    "/events/:path*",
    "/documents/:path*",
    "/board/documents/:path*",
    "/admin/documents/:path*",
    "/communication/:path*",
    "/finance/:path*",
    "/sponsors/:path*",
    "/suppliers/:path*",
  ],
};

const SETTINGS_CACHE_TTL_MS = 30_000;

let cachedModules: Record<string, boolean> | null = null;
let cachedAt = 0;

/**
 * Fetch the module map from the public settings endpoint, cached for
 * {@link SETTINGS_CACHE_TTL_MS}. On any failure, returns the last cached value (or an
 * empty map → every module treated as enabled, behaviour-preserving).
 */
async function getModules(): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (cachedModules && now - cachedAt < SETTINGS_CACHE_TTL_MS) {
    return cachedModules;
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
    const response = await fetch(`${baseUrl}/api/v1/settings/public`);
    if (response.ok) {
      const data = await response.json();
      // Validate the shape — a malformed `modules` field must not silently disable gating.
      cachedModules = sanitizeModuleMap(data.modules);
      cachedAt = now;
    }
  } catch {
    // Network/API failure — fall through to whatever (if anything) is cached. A stale or
    // empty map means "treat as enabled", which is behaviour-preserving; the backend 403
    // is still the real control.
  }

  return cachedModules ?? {};
}

/**
 * Whether the request carries a valid signed next-auth / Auth.js JWT.
 *
 * REQ-087 (Round-2 [Review][Patch] DN-1): validate the JWT (not just the cookie name) —
 * the round-1 cookie-shape regex made the neutral "site off" UX trivially bypassable
 * (any visitor could set `document.cookie = "authjs.session-token=anything"` and defeat
 * the rewrite to `/site-unavailable`). `getToken` from `next-auth/jwt` is Edge-compatible
 * and verifies the HMAC signature, so a forged cookie returns `null` here. As a free
 * bonus, `getToken` handles all the cookie variants we used to hand-match (chunked,
 * `__Secure-`/`__Host-` prefixes, next-auth v4 vs Auth.js v5 names).
 */
async function hasAuthSession(request: NextRequest): Promise<boolean> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  return token !== null;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const modules = await getModules();

  // REQ-087 (E10-S5): Public View gate. When public_view is off, the public site is not
  // served — /public/* and the *unauthenticated* landing `/` are rewritten to a neutral
  // page (OD-5: a neutral page, not a login redirect).
  if (modules.public_view === false) {
    // Round-2 [Review][Patch] (P-S5-4): explicit segment matching. A bare
    // `startsWith("/public")` also matches `/publication`, `/publichistory`, etc.;
    // `startsWith("/public/unsubscribe")` also exempts `/public/unsubscribe-page`. Pin
    // the matches to the actual segments so an accidental matcher widening (or a new
    // future route prefix) cannot quietly mis-classify a path.
    //
    // Q1: transactional email-unsubscribe links stay reachable for compliance even when
    // the public site is switched off.
    const isUnsubscribe =
      pathname === "/public/unsubscribe" ||
      pathname.startsWith("/public/unsubscribe/");
    const isPublic =
      pathname === "/public" || pathname.startsWith("/public/");
    if (isPublic && !isUnsubscribe) {
      return NextResponse.rewrite(new URL("/site-unavailable", request.url));
    }
    // `/` is dual-purpose (landing + dashboard) — only rewrite it for unauthenticated
    // visitors; an authenticated user still gets their dashboard.
    if (pathname === "/" && !(await hasAuthSession(request))) {
      return NextResponse.rewrite(new URL("/site-unavailable", request.url));
    }
  }

  // REQ-087 (E10-S4): per-module direct-URL route guard for the authenticated app routes.
  const moduleKey = resolveModuleForPath(pathname);
  // Unknown key / fetch failure => treated as enabled (behaviour-preserving).
  if (moduleKey && modules[moduleKey] === false) {
    // Rewrite (not redirect) so the URL stays meaningful and the user sees an explanatory
    // page rather than a confusing silent jump.
    return NextResponse.rewrite(new URL("/module-unavailable", request.url));
  }

  return NextResponse.next();
}

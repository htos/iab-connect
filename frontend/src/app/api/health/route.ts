// SPDX-License-Identifier: AGPL-3.0-or-later
// E13-S4 AC-2 / ADR-017: Railway healthcheckPath for the `web` service. Returns a fixed-size
// 200 JSON so Railway's edge proxy can determine readiness without paying the cost of rendering
// the full landing-page HTML (~108 KB SSR body) on every 10-second probe.

export function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}

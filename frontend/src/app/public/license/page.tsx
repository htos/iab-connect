// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from "node:fs";
import path from "node:path";
import { getTranslations } from "next-intl/server";

/**
 * REQ-089 AC-4 (E20-S4) / ADR-021: static AGPL-3.0-or-later license-text page reached by
 * the `<LicenseFooter />` "AGPL-3.0-or-later" link. Server Component — the LICENSE file is
 * read at build time via Node `fs`. When the file is missing (development frontend run from
 * a partial checkout, or a published Docker image whose build context did not include the
 * repo root), the page degrades gracefully to an external link at gnu.org so the legal
 * obligation is still satisfied. NEVER throws / 500s.
 *
 * The page inherits `app/public/layout.tsx` (PublicHeader + main + PublicFooter), and the
 * root `LicenseFooter` renders below — the cohabitation of dark PublicFooter + slim license
 * bar is intentional, see E20-S4 AC-10.
 */
export default async function LicensePage() {
  const t = await getTranslations("publicLicense");

  let licenseText: string | null = null;
  try {
    // process.cwd() inside `frontend/` → walk up to repo root where LICENSE lives (E20-S1).
    licenseText = fs.readFileSync(
      path.join(process.cwd(), "..", "LICENSE"),
      "utf-8",
    );
  } catch (err) {
    // E20-S1 hasn't landed yet OR the build context excludes the repo root (e.g. the
    // E12-S2 Dockerfile WORKDIR is `frontend/` only). Either way, fall back to the
    // canonical FSF URL — the page stays functional and the legal disclosure stays valid.
    console.warn("[E20-S4] LICENSE file not readable at build time:", err);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-4 text-gray-700">{t("body")}</p>
      {licenseText ? (
        <pre className="mt-6 overflow-auto rounded bg-gray-50 p-4 text-xs whitespace-pre-wrap text-gray-800">
          {licenseText}
        </pre>
      ) : (
        <a
          href="https://www.gnu.org/licenses/agpl-3.0.txt"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block text-orange-600 hover:underline"
        >
          {t("viewExternal")}
        </a>
      )}
    </div>
  );
}

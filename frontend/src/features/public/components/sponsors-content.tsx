// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPublicSponsors } from "../api/public-content-api";
import {
  getHighestTier,
  TIER_COLORS,
  TIER_LABELS,
  TIER_ORDER,
  type PublicSponsorDto,
} from "../types/public.types";

/**
 * E28-S2: public sponsors page as a full async Server Component (DEC-4=A — the
 * cleanest conversion: no client island). Behaviour-preserving vs the god-page
 * (`sponsors/page.tsx`); the only A79 delta is the removed client loading-spinner
 * lifecycle (RSC fetches at request time — there is no client "loading" state in
 * the server-rendered output; an error/empty is rendered from the awaited result).
 * The error/empty COPY is identical. Tier grouping, hardcoded German
 * `TIER_LABELS.de` headings, `getHighestTier`, the /public/contact CTA, and the
 * hardcoded "Website" link are unchanged.
 */
export default async function SponsorsContent() {
  const t = await getTranslations("publicSponsors");

  let sponsors: PublicSponsorDto[] = [];
  let error = false;
  try {
    sponsors = await getPublicSponsors();
  } catch {
    error = true;
  }

  // Group sponsors by highest tier
  const grouped: Record<string, PublicSponsorDto[]> = {};
  const partners: PublicSponsorDto[] = [];

  sponsors.forEach((s) => {
    const tier = getHighestTier(s.packages);
    if (!tier) {
      partners.push(s);
    } else {
      if (!grouped[tier]) grouped[tier] = [];
      grouped[tier].push(s);
    }
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="mb-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-4 text-lg text-gray-600">{t("subtitle")}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <p className="text-red-700">{t("errorMessage")}</p>
        </div>
      )}

      {/* Empty */}
      {!error && sponsors.length === 0 && (
        <div className="rounded-xl bg-gray-50 p-12 text-center">
          <p className="text-gray-500">{t("empty")}</p>
        </div>
      )}

      {/* Sponsor tiers */}
      {!error &&
        sponsors.length > 0 &&
        TIER_ORDER.map((tier) => {
          const tierSponsors = grouped[tier];
          if (!tierSponsors || tierSponsors.length === 0) return null;

          return (
            <section key={tier} className="mb-16">
              <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">
                {TIER_LABELS[tier]?.de ?? tier}
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {tierSponsors.map((sponsor) => (
                  <SponsorCard key={sponsor.id} sponsor={sponsor} tier={tier} />
                ))}
              </div>
            </section>
          );
        })}

      {/* Partners (no packages) */}
      {!error && partners.length > 0 && (
        <section className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">
            {t("partnerTitle")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((sponsor) => (
              <SponsorCard key={sponsor.id} sponsor={sponsor} tier={null} />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mt-16 rounded-2xl bg-linear-to-r from-orange-500 to-orange-600 p-12 text-center text-white">
        <h2 className="text-3xl font-bold">{t("ctaTitle")}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-orange-100">
          {t("ctaDescription")}
        </p>
        <Link
          href="/public/contact"
          className="mt-8 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-orange-600 shadow-md transition-colors hover:bg-orange-50"
        >
          {t("ctaButton")}
        </Link>
      </section>
    </div>
  );
}

function SponsorCard({
  sponsor,
  tier,
}: {
  sponsor: PublicSponsorDto;
  tier: string | null;
}) {
  const colors = tier
    ? (TIER_COLORS[tier] ?? TIER_COLORS.Basis)
    : TIER_COLORS.Basis;

  return (
    <div
      className={`flex flex-col rounded-xl border bg-linear-to-br p-6 shadow-sm transition-shadow hover:shadow-md ${colors}`}
    >
      <h3 className="text-lg font-semibold text-gray-900">
        {sponsor.companyName}
      </h3>
      {sponsor.contactPerson && (
        <p className="mt-1 text-sm text-gray-500">{sponsor.contactPerson}</p>
      )}
      {sponsor.description && (
        <p className="mt-3 flex-1 text-sm text-gray-600">
          {sponsor.description}
        </p>
      )}
      {sponsor.website && (
        <a
          href={sponsor.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          Website
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      )}
    </div>
  );
}

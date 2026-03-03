'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface PublicSponsorDto {
  id: string;
  companyName: string;
  contactPerson?: string;
  website?: string;
  description?: string;
  packages: { name: string; tier: string }[];
}

const TIER_ORDER = ['Platin', 'Gold', 'Silber', 'Bronze', 'Basis'] as const;

const TIER_LABELS: Record<string, { de: string; en: string }> = {
  Platin: { de: 'Platin', en: 'Platinum' },
  Gold: { de: 'Gold', en: 'Gold' },
  Silber: { de: 'Silber', en: 'Silver' },
  Bronze: { de: 'Bronze', en: 'Bronze' },
  Basis: { de: 'Basis', en: 'Basic' },
};

const TIER_COLORS: Record<string, string> = {
  Platin: 'from-gray-100 to-gray-200 border-gray-300',
  Gold: 'from-yellow-50 to-amber-100 border-amber-300',
  Silber: 'from-gray-50 to-slate-100 border-slate-300',
  Bronze: 'from-orange-50 to-amber-50 border-orange-300',
  Basis: 'from-white to-gray-50 border-gray-200',
};

function getHighestTier(packages: { name: string; tier: string }[]): string | null {
  if (packages.length === 0) return null;
  for (const tier of TIER_ORDER) {
    if (packages.some((p) => p.tier === tier)) return tier;
  }
  return packages[0].tier;
}

export default function PublicSponsorsPage() {
  const t = useTranslations('publicSponsors');

  const [sponsors, setSponsors] = useState<PublicSponsorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchSponsors = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/v1/sponsors/public`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data: PublicSponsorDto[] = await res.json();
        setSponsors(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchSponsors();
  }, []);

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
        <h1 className="text-4xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-4 text-lg text-gray-600">{t('subtitle')}</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <svg className="h-10 w-10 animate-spin text-orange-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <p className="text-red-700">{t('errorMessage')}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && sponsors.length === 0 && (
        <div className="rounded-xl bg-gray-50 p-12 text-center">
          <p className="text-gray-500">{t('empty')}</p>
        </div>
      )}

      {/* Sponsor tiers */}
      {!loading &&
        !error &&
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
      {!loading && !error && partners.length > 0 && (
        <section className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">{t('partnerTitle')}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((sponsor) => (
              <SponsorCard key={sponsor.id} sponsor={sponsor} tier={null} />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      {!loading && (
        <section className="mt-16 rounded-2xl bg-linear-to-r from-orange-500 to-orange-600 p-12 text-center text-white">
          <h2 className="text-3xl font-bold">{t('ctaTitle')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-orange-100">{t('ctaDescription')}</p>
          <Link
            href="/public/contact"
            className="mt-8 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-orange-600 shadow-md hover:bg-orange-50 transition-colors"
          >
            {t('ctaButton')}
          </Link>
        </section>
      )}
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
  const colors = tier ? TIER_COLORS[tier] ?? TIER_COLORS.Basis : TIER_COLORS.Basis;

  return (
    <div
      className={`flex flex-col rounded-xl border bg-linear-to-br p-6 shadow-sm transition-shadow hover:shadow-md ${colors}`}
    >
      <h3 className="text-lg font-semibold text-gray-900">{sponsor.companyName}</h3>
      {sponsor.contactPerson && (
        <p className="mt-1 text-sm text-gray-500">{sponsor.contactPerson}</p>
      )}
      {sponsor.description && (
        <p className="mt-3 flex-1 text-sm text-gray-600">{sponsor.description}</p>
      )}
      {sponsor.website && (
        <a
          href={sponsor.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          Website
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}

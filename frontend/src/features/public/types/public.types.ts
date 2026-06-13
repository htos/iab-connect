// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * E28-S2: DTOs + tier constants for the public content slice, relocated from the
 * inline page interfaces (DEC-3=A — these are public-site-scoped; no lib home
 * exists for blog/sponsors). The list/detail DTO near-duplicates are reconciled
 * to the LIST variant (the superset that carries `contentLanguage?`).
 *
 * The public sponsors shape is fully INDEPENDENT of `features/sponsors/` (a 6-field
 * public DTO keyed off German tier names over /api/v1/sponsors/public, disjoint
 * from the authenticated slice's English `SponsorTier` vocabulary).
 */

export interface PublicBlogPostDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  tags: string[];
  publishedAt: string;
  imageUrl?: string;
  // List variant carries the REQ-055 content-language; detail dropped it — the
  // superset keeps it optional so one DTO serves both surfaces.
  contentLanguage?: string;
}

/** REQ-022 (E4-S3): public fee category for the event registration page. */
export interface PublicFeeCategory {
  id: string;
  name: string;
  description?: string | null;
  amount: number;
  currency: string;
}

export interface PublicEventDto {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  location: string;
  locationAddress?: string;
  locationUrl?: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  maxParticipants?: number;
  registrationRequired: boolean;
  registrationDeadline?: string;
  waitlistEnabled: boolean;
  visibility: string;
  status: string;
  category: string;
  tags: string[];
  imageUrl?: string;
  imageAltText?: string;
  organizerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  cost?: number;
  costDescription?: string;
  isFree: boolean;
  // List variant only (REQ-055); optional in the superset.
  contentLanguage?: string;
  hasStarted: boolean;
  hasEnded: boolean;
  isRegistrationOpen: boolean;
}

/** Payload for the public event-registration POST (byte-identical to the god-page). */
export interface PublicRegistrationPayload {
  name: string;
  email: string;
  phone?: string;
  numberOfGuests: number;
  specialRequirements?: string;
  feeCategoryId?: string;
}

export interface PublicRegistrationResult {
  isWaitlisted: boolean;
  waitlistPosition?: number;
}

export interface PublicSponsorDto {
  id: string;
  companyName: string;
  contactPerson?: string;
  website?: string;
  description?: string;
  packages: { name: string; tier: string }[];
}

// Sponsor tier vocabulary — German tier names, public-site-scoped (independent of
// `features/sponsors/`). Relocated verbatim from `sponsors/page.tsx`.
export const TIER_ORDER = [
  "Platin",
  "Gold",
  "Silber",
  "Bronze",
  "Basis",
] as const;

export const TIER_LABELS: Record<string, { de: string; en: string }> = {
  Platin: { de: "Platin", en: "Platinum" },
  Gold: { de: "Gold", en: "Gold" },
  Silber: { de: "Silber", en: "Silver" },
  Bronze: { de: "Bronze", en: "Bronze" },
  Basis: { de: "Basis", en: "Basic" },
};

export const TIER_COLORS: Record<string, string> = {
  Platin: "from-gray-100 to-gray-200 border-gray-300",
  Gold: "from-yellow-50 to-amber-100 border-amber-300",
  Silber: "from-gray-50 to-slate-100 border-slate-300",
  Bronze: "from-orange-50 to-amber-50 border-orange-300",
  Basis: "from-white to-gray-50 border-gray-200",
};

export function getHighestTier(
  packages: { name: string; tier: string }[]
): string | null {
  if (packages.length === 0) return null;
  for (const tier of TIER_ORDER) {
    if (packages.some((p) => p.tier === tier)) return tier;
  }
  return packages[0].tier;
}

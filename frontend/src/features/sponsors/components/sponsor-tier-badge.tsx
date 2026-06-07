import type { SponsorTier } from "../types/sponsor.types";

/**
 * S2-DEC-1 (Option A): a feature-local tier badge that encapsulates the four
 * tier colours in ONE place.
 *
 * Tier (Bronze/Silver/Gold/Platinum) is intrinsically colour-coded — the colour
 * IS the meaning (like a traffic light), so unlike status it is NOT mapped onto
 * the four generic `ui/badge` variants (that would mislabel e.g. Gold→destructive
 * red — a visual regression the characterization suite cannot catch, the A76
 * class). It is deliberately NOT baked into the shared `ui/badge.tsx` primitive
 * either (E21 rule: no domain coupling on the shared `ui` primitive — tier is a
 * sponsor concept).
 *
 * The four colour classes are preserved VERBATIM from the original god-page
 * (`app/sponsors/page.tsx` getTierBadge) so the visuals do not regress; this only
 * de-scatters them into one named component. The tier VALUE (not a translation
 * key) is the label, exactly as before. A77: these are literal Tailwind utility
 * classes (a documented semantic-colour exception), not brand design tokens, so
 * there is no named-token value to verify against — they are copied by identity.
 */
const TIER_CLASS: Record<SponsorTier, string> = {
  Bronze: "bg-amber-100 text-amber-800",
  Silver: "bg-gray-200 text-gray-700",
  Gold: "bg-yellow-100 text-yellow-800",
  Platinum: "bg-purple-100 text-purple-800",
};

export function SponsorTierBadge({ tier }: { tier: SponsorTier }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${TIER_CLASS[tier]}`}
    >
      {tier}
    </span>
  );
}

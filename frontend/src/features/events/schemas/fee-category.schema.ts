import { z } from "zod";
import type { useTranslations } from "next-intl";
import { FEE_CURRENCIES } from "../types/events.types";

/**
 * Fee-category form schema (E24-S3) — applies the E22 RHF+Zod form sub-recipe to
 * the Events fee-category dialog. Behaviour-preserving (A79): the schema is built
 * per-render with the next-intl translator so every validation message is the
 * SAME localized key the god-page used (`validation.*`). Mirrors the backend
 * validator (name required/max, amount min/<=2 decimals, currency enum, optional
 * window with until>from, maxQuantity integer>=1 or blank). Datetime conversion
 * (Zurich↔UTC) is NOT done here — it happens at submit in the dialog component,
 * exactly as the god-page did.
 */
export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 500;

function decimalPlaces(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const s = String(n);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function buildFeeSchema(t: ReturnType<typeof useTranslations>) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, t("validation.nameRequired"))
        .max(NAME_MAX, t("validation.nameTooLong")),
      description: z
        .string()
        .max(DESCRIPTION_MAX, t("validation.descriptionTooLong")),
      amount: z
        .number({ invalid_type_error: t("validation.amountInvalid") })
        .min(0, t("validation.amountMin"))
        .refine((a) => decimalPlaces(a) <= 2, t("validation.amountDecimals")),
      currency: z.enum(FEE_CURRENCIES, {
        errorMap: () => ({ message: t("validation.currencyInvalid") }),
      }),
      applicability: z.enum(["Everyone", "MembersOnly", "PublicOnly"]),
      availableFrom: z.string(),
      availableUntil: z.string(),
      maxQuantity: z
        .string()
        .refine(
          (v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1),
          t("validation.maxQuantityMin")
        ),
    })
    .refine(
      (v) =>
        !v.availableFrom ||
        !v.availableUntil ||
        new Date(v.availableFrom) < new Date(v.availableUntil),
      { message: t("validation.untilAfterFrom"), path: ["availableUntil"] }
    );
}

export type FeeFormValues = z.infer<ReturnType<typeof buildFeeSchema>>;

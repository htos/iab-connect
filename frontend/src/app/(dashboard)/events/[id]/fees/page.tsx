/**
 * REQ-022 (E4-S1): Event fee-category management page for event staff.
 *
 * A fee category carries a name, amount, currency, applicability (everyone / members-only /
 * public-only), an optional availability window, and an optional sold-quantity cap. The
 * create/edit form is a react-hook-form + zod form rendered inside a Radix dialog (mirrors the
 * volunteer-shift form). Categories are soft-retired (deactivated), never hard-deleted, because
 * E4-S2 invoices reference a category id.
 *
 * Because the fee API is a sub-resource keyed by an existing event id
 * (`/api/v1/events/{eventId}/fee-categories`), fee categories are managed here on a dedicated
 * page reached from the event detail action bar — not on the event create form (which has no id
 * yet). Backend `RequireEventFeeManager` is the security boundary; the role guard here is UX-only.
 */
"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FEE_CURRENCIES,
  type EventFeeCategoryDto,
  type FeeApplicability,
  createEventFeeCategory,
  deactivateEventFeeCategory,
  getEventFeeCategories,
  updateEventFeeCategory,
} from "@/lib/services/events";

const ZURICH_TIME_ZONE = "Europe/Zurich";
const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

const APPLICABILITIES: FeeApplicability[] = [
  "Everyone",
  "MembersOnly",
  "PublicOnly",
];

function formatZurich(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString("de-CH", {
    timeZone: ZURICH_TIME_ZONE,
  });
}

/**
 * Convert an ISO-UTC string to the `yyyy-MM-ddTHH:mm` form expected by
 * `<input type="datetime-local">`, rendered in Europe/Zurich wall-clock time (same approach the
 * volunteer-shift form uses to avoid the slice-the-Z offset bug).
 */
function utcIsoToZurichLocalInput(isoUtc: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZURICH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoUtc));
  const lookup = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${lookup("year")}-${lookup("month")}-${lookup("day")}T${lookup("hour")}:${lookup("minute")}`;
}

/**
 * Convert a `<input type="datetime-local">` value (entered in Europe/Zurich wall-clock time) into
 * an ISO-UTC string for the API, DST-correct via the Intl offset.
 */
function zurichLocalInputToUtcIso(localInput: string): string {
  if (!localInput) return "";
  const asUtc = new Date(`${localInput}:00.000Z`);
  if (Number.isNaN(asUtc.getTime())) return "";
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZURICH_TIME_ZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(asUtc);
  const offsetLabel =
    tzParts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offsetLabel);
  const sign = match?.[1] === "-" ? -1 : 1;
  const hours = match ? parseInt(match[2], 10) : 0;
  const minutes = match?.[3] ? parseInt(match[3], 10) : 0;
  const offsetMinutes = sign * (hours * 60 + minutes);
  return new Date(asUtc.getTime() - offsetMinutes * 60_000).toISOString();
}

type FeeFormValues = {
  name: string;
  description: string;
  amount: number;
  currency: string;
  applicability: FeeApplicability;
  availableFrom: string;
  availableUntil: string;
  maxQuantity: string;
};

/**
 * Zod schema for the fee-category form. Built per-render with the next-intl translator so every
 * validation message is localized. Mirrors the backend validator (name/amount/decimals/window).
 */
function buildFeeSchema(t: ReturnType<typeof useTranslations>) {
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

function decimalPlaces(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const s = String(n);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

type FeeFormTarget = {
  mode: "create" | "edit";
  categoryId?: string;
  initial: FeeFormValues;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500";

function FeeFormDialog({
  target,
  eventId,
  onClose,
  onSaved,
  onError,
}: {
  target: FeeFormTarget;
  eventId: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const t = useTranslations("events.fees");
  const schema = useMemo(() => buildFeeSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FeeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: target.initial,
  });

  const onSubmit = async (values: FeeFormValues) => {
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      amount: values.amount,
      currency: values.currency,
      applicability: values.applicability,
      availableFrom: values.availableFrom
        ? zurichLocalInputToUtcIso(values.availableFrom)
        : null,
      availableUntil: values.availableUntil
        ? zurichLocalInputToUtcIso(values.availableUntil)
        : null,
      maxQuantity: values.maxQuantity ? Number(values.maxQuantity) : null,
    };
    const res = target.categoryId
      ? await updateEventFeeCategory(eventId, target.categoryId, payload)
      : await createEventFeeCategory(eventId, payload);
    if (res.data) {
      onSaved();
    } else {
      onError(res.error ?? t("saveFailed"));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {target.mode === "edit" ? t("editCategory") : t("newCategory")}
          </DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("name")}
              </span>
              <input
                type="text"
                {...register("name")}
                className={inputClass}
                maxLength={NAME_MAX}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.name.message}
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("amount")}
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                {...register("amount", { valueAsNumber: true })}
                className={inputClass}
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.amount.message}
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("currency")}
              </span>
              <select {...register("currency")} className={inputClass}>
                {FEE_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.currency && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.currency.message}
                </p>
              )}
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("applicability")}
              </span>
              <select {...register("applicability")} className={inputClass}>
                {APPLICABILITIES.map((a) => (
                  <option key={a} value={a}>
                    {t(`applicabilityOptions.${a}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("availableFrom")}
              </span>
              <input
                type="datetime-local"
                {...register("availableFrom")}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("availableUntil")}
              </span>
              <input
                type="datetime-local"
                {...register("availableUntil")}
                className={inputClass}
              />
              {errors.availableUntil && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.availableUntil.message}
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("maxQuantity")}
              </span>
              <input
                type="number"
                min={1}
                {...register("maxQuantity")}
                className={inputClass}
              />
              {errors.maxQuantity && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.maxQuantity.message}
                </p>
              )}
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("description")}
              </span>
              <textarea
                {...register("description")}
                className={inputClass}
                rows={2}
                maxLength={DESCRIPTION_MAX}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.description.message}
                </p>
              )}
            </label>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {t("save")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EventFeesPage({ params }: PageProps) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const t = useTranslations("events.fees");
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
    roles: userRoles,
  } = useAuth();
  const isEventManager = userRoles.includes("event-manager");
  const isKassier = userRoles.includes("kassier");
  const canManage = isVorstand || isAdmin || isEventManager || isKassier;

  const [categories, setCategories] = useState<EventFeeCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formTarget, setFormTarget] = useState<FeeFormTarget | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !canManage) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getEventFeeCategories(eventId);
        if (cancelled) return;
        if (res.data) setCategories(res.data);
        else setError(t("loadFailed"));
      } catch {
        if (!cancelled) setError(t("loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, refreshKey, canManage, isAuthenticated, t]);

  const { active, inactive } = useMemo(() => {
    return {
      active: categories.filter((c) => c.isActive),
      inactive: categories.filter((c) => !c.isActive),
    };
  }, [categories]);

  const openCreate = useCallback(() => {
    setFormTarget({
      mode: "create",
      initial: {
        name: "",
        description: "",
        amount: 0,
        currency: FEE_CURRENCIES[0],
        applicability: "Everyone",
        availableFrom: "",
        availableUntil: "",
        maxQuantity: "",
      },
    });
  }, []);

  const openEdit = useCallback((c: EventFeeCategoryDto) => {
    setFormTarget({
      mode: "edit",
      categoryId: c.id,
      initial: {
        name: c.name,
        description: c.description ?? "",
        amount: c.amount,
        currency: c.currency,
        applicability: c.applicability,
        availableFrom: c.availableFrom
          ? utcIsoToZurichLocalInput(c.availableFrom)
          : "",
        availableUntil: c.availableUntil
          ? utcIsoToZurichLocalInput(c.availableUntil)
          : "",
        maxQuantity: c.maxQuantity != null ? String(c.maxQuantity) : "",
      },
    });
  }, []);

  const handleDeactivate = useCallback(
    async (categoryId: string) => {
      if (!confirm(t("confirmDeactivate"))) return;
      setActionInFlight(categoryId);
      try {
        const res = await deactivateEventFeeCategory(eventId, categoryId);
        if (res.data) setRefreshKey((k) => k + 1);
        else setError(t("saveFailed"));
      } finally {
        setActionInFlight(null);
      }
    },
    [eventId, t]
  );

  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 h-8 w-64 animate-pulse rounded bg-gray-200" />
          <div className="h-96 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </main>
    );
  }

  if (!isAuthenticated) return null;

  if (!canManage) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div
            role="alert"
            className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800"
          >
            {t("permissionDenied")}
          </div>
        </div>
      </main>
    );
  }

  const renderRow = (c: EventFeeCategoryDto) => (
    <tr key={c.id} className="border-b last:border-0">
      <td className="py-2 font-medium text-gray-900">{c.name}</td>
      <td className="py-2">{formatCurrency(c.amount, c.currency)}</td>
      <td className="py-2">{t(`applicabilityOptions.${c.applicability}`)}</td>
      <td className="py-2 text-gray-600">
        {c.availableFrom || c.availableUntil ? (
          <>
            {c.availableFrom ? formatZurich(c.availableFrom) : "–"}
            {" → "}
            {c.availableUntil ? formatZurich(c.availableUntil) : "–"}
          </>
        ) : (
          t("alwaysAvailable")
        )}
      </td>
      <td className="py-2 text-right">
        {c.isActive ? (
          <>
            <button
              type="button"
              onClick={() => openEdit(c)}
              className="mr-3 text-sm font-medium text-orange-700 hover:text-orange-800"
            >
              {t("edit")}
            </button>
            <button
              type="button"
              onClick={() => handleDeactivate(c.id)}
              disabled={actionInFlight === c.id}
              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {t("deactivate")}
            </button>
          </>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
            {t("retired")}
          </span>
        )}
      </td>
    </tr>
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/events/${eventId}`}
          className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-orange-600"
        >
          ← {t("backToEvent")}
        </Link>

        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("pageTitle")}
            </h1>
            <p className="mt-1 text-gray-500">{t("pageDescription")}</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            {t("newCategory")}
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-4 flex justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="font-medium"
            >
              ×
            </button>
          </div>
        )}

        {formTarget && (
          <FeeFormDialog
            key={formTarget.categoryId ?? "new"}
            target={formTarget}
            eventId={eventId}
            onClose={() => setFormTarget(null)}
            onSaved={() => {
              setFormTarget(null);
              setRefreshKey((k) => k + 1);
            }}
            onError={(message) => setError(message)}
          />
        )}

        {active.length === 0 && inactive.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
            {t("noCategories")}
          </div>
        ) : (
          <section className="mb-4 rounded-xl bg-white p-4 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">{t("name")}</th>
                  <th className="py-2">{t("amount")}</th>
                  <th className="py-2">{t("applicability")}</th>
                  <th className="py-2">{t("availability")}</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {active.map(renderRow)}
                {inactive.map(renderRow)}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}

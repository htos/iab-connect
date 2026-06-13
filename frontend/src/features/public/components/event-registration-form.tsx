"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/utils";
import { registerForEventPublic } from "../api/public-content-api";
import type { PublicEventDto, PublicFeeCategory } from "../types/public.types";

interface RegistrationForm {
  participantName: string;
  participantEmail: string;
  participantPhone: string;
  numberOfGuests: number;
  specialRequirements: string;
}

/**
 * E28-S2: the event-detail registration client island (DEC-4=A). The heaviest
 * island — preserved as MANUAL `useState` (NOT RHF-ified; RHF+Zod is S3's
 * contact/newsletter scope and does NOT extend here). Owns the registration state
 * machine (closed / form / success / waitlist / paid), the fee selection, and the
 * `POST …/registrations/public` (now via the slice `registerForEventPublic` fn —
 * byte-identical payload `{name,email,phone?,numberOfGuests,specialRequirements?,
 * feeCategoryId?}`). The fee section stays mounted through this island so the
 * REQ-022 fee test stays green.
 */
export function EventRegistrationForm({
  event,
  feeCategories,
  eventId,
}: {
  event: PublicEventDto;
  feeCategories: PublicFeeCategory[];
  eventId: string;
}) {
  const t = useTranslations("publicEvents");

  const [form, setForm] = useState<RegistrationForm>({
    participantName: "",
    participantEmail: "",
    participantPhone: "",
    numberOfGuests: 1,
    specialRequirements: "",
  });
  const [selectedFeeId, setSelectedFeeId] = useState<string>(
    feeCategories.length === 1 ? feeCategories[0].id : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registrationResult, setRegistrationResult] = useState<{
    isWaitlisted: boolean;
    waitlistPosition?: number;
    paidFee?: PublicFeeCategory | null;
  } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "numberOfGuests" ? Math.max(1, parseInt(value) || 1) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const data = await registerForEventPublic(eventId, {
        name: form.participantName,
        email: form.participantEmail,
        phone: form.participantPhone || undefined,
        numberOfGuests: form.numberOfGuests,
        specialRequirements: form.specialRequirements || undefined,
        feeCategoryId: selectedFeeId || undefined,
      });
      const paidFee =
        !data.isWaitlisted && selectedFeeId
          ? (feeCategories.find((f) => f.id === selectedFeeId) ?? null)
          : null;
      setRegistrationResult({
        isWaitlisted: data.isWaitlisted,
        waitlistPosition: data.waitlistPosition,
        paidFee,
      });
      setSubmitSuccess(true);
      setForm({
        participantName: "",
        participantEmail: "",
        participantPhone: "",
        numberOfGuests: 1,
        specialRequirements: "",
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : t("registrationError")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8 border-t pt-8">
      <h2 className="text-lg font-semibold text-gray-900">
        {t("registration")}
      </h2>

      {!event.isRegistrationOpen ? (
        <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-yellow-800">
          {t("registrationClosed")}
        </div>
      ) : submitSuccess ? (
        <div
          className={`mt-4 rounded-lg border p-6 text-center ${
            registrationResult?.isWaitlisted
              ? "border-yellow-200 bg-yellow-50"
              : "border-green-200 bg-green-50"
          }`}
        >
          <svg
            className={`mx-auto h-10 w-10 ${
              registrationResult?.isWaitlisted
                ? "text-yellow-500"
                : "text-green-500"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            {registrationResult?.isWaitlisted ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
          </svg>
          {registrationResult?.isWaitlisted ? (
            <>
              <p className="mt-3 font-medium text-yellow-800">
                {t("registration.waitlistSuccess", {
                  position: registrationResult.waitlistPosition ?? 0,
                })}
              </p>
              <p className="mt-1 text-sm text-yellow-700">
                {t("registration.waitlistPosition", {
                  position: registrationResult.waitlistPosition ?? 0,
                })}
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 font-medium text-green-800">
                {t("registrationSuccess")}
              </p>
              <p className="mt-1 text-sm text-green-700">
                {t("registrationSuccessDetail")}
              </p>
              {registrationResult?.paidFee && (
                <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-left">
                  <p className="text-sm font-medium text-orange-900">
                    {t("fee.amountDue", {
                      amount: formatCurrency(
                        registrationResult.paidFee.amount,
                        registrationResult.paidFee.currency
                      ),
                    })}
                  </p>
                  <p className="mt-1 text-sm text-orange-800">
                    {t("fee.paymentPendingNotice")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="participantName"
                className="block text-sm font-medium text-gray-700"
              >
                {t("formName")} *
              </label>
              <input
                type="text"
                id="participantName"
                name="participantName"
                required
                value={form.participantName}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="participantEmail"
                className="block text-sm font-medium text-gray-700"
              >
                {t("formEmail")} *
              </label>
              <input
                type="email"
                id="participantEmail"
                name="participantEmail"
                required
                value={form.participantEmail}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="participantPhone"
                className="block text-sm font-medium text-gray-700"
              >
                {t("formPhone")}
              </label>
              <input
                type="tel"
                id="participantPhone"
                name="participantPhone"
                value={form.participantPhone}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="numberOfGuests"
                className="block text-sm font-medium text-gray-700"
              >
                {t("formGuests")}
              </label>
              <input
                type="number"
                id="numberOfGuests"
                name="numberOfGuests"
                min={1}
                value={form.numberOfGuests}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="specialRequirements"
              className="block text-sm font-medium text-gray-700"
            >
              {t("formRequirements")}
            </label>
            <textarea
              id="specialRequirements"
              name="specialRequirements"
              rows={3}
              value={form.specialRequirements}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* REQ-022 (E4-S3): fee category selection + payment-pending notice */}
          {feeCategories.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-medium text-orange-900">
                {t("fee.sectionTitle")}
              </p>
              {feeCategories.length === 1 ? (
                <p className="mt-1 text-sm text-orange-800">
                  {feeCategories[0].name} —{" "}
                  {formatCurrency(
                    feeCategories[0].amount,
                    feeCategories[0].currency
                  )}
                </p>
              ) : (
                <fieldset className="mt-2 space-y-2">
                  <legend className="sr-only">{t("fee.choose")}</legend>
                  {feeCategories.map((fee) => (
                    <label
                      key={fee.id}
                      className="flex items-center gap-2 text-sm text-orange-900"
                    >
                      <input
                        type="radio"
                        name="feeCategory"
                        value={fee.id}
                        checked={selectedFeeId === fee.id}
                        onChange={() => setSelectedFeeId(fee.id)}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>
                        {fee.name} — {formatCurrency(fee.amount, fee.currency)}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              <p className="mt-2 text-xs text-orange-700">
                {t("fee.paymentPendingNotice")}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-lg bg-[#EA580C] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <svg
                  className="mr-2 h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {t("submitting")}
              </>
            ) : (
              t("register")
            )}
          </button>
        </form>
      )}
    </div>
  );
}

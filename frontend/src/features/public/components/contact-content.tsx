"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import { ContactForm } from "./contact-form";
import { submitContact } from "../api/public-forms-api";
import type { PublicContactValues } from "../schemas/public-contact.schema";

type FormStatus = "idle" | "loading" | "success" | "error";

/**
 * E28-S3: the public contact page (client island — DEC-2=A; the sidebar reads
 * `settings.applicationName` from the client `AppSettingsProvider` context). Owns
 * the idle→loading→success/error status machine, the honeypot short-circuit, the
 * `submitContact` call, the "send another" panel, and the sidebar. The form fields
 * are the RHF+Zod `<ContactForm>` island. Behaviour-preserving vs `contact/page.tsx`.
 */
export default function ContactContent() {
  const t = useTranslations("publicContact");
  const { settings } = useAppSettings();
  const [status, setStatus] = useState<FormStatus>("idle");

  const handleSubmit = async (values: PublicContactValues) => {
    // Honeypot check — silently pretend success (pre-fetch, raw value, DEC-3).
    if (values.website) {
      setStatus("success");
      return;
    }

    setStatus("loading");
    try {
      await submitContact(values);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center rounded-xl bg-green-50 p-12 text-center">
          <svg
            className="mb-4 h-16 w-16 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            {t("successTitle")}
          </h2>
          <p className="mb-6 text-gray-600">{t("successMessage")}</p>
          <button
            onClick={() => setStatus("idle")}
            className="rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
          >
            {t("sendAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-4 text-lg text-gray-600">{t("subtitle")}</p>
      </div>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Form — 2 cols */}
        <div className="lg:col-span-2">
          {/* `status` is narrowed to idle|loading|error here (success returns early). */}
          <ContactForm onSubmit={handleSubmit} status={status} />
        </div>

        {/* Contact Info Sidebar — 1 col */}
        <div className="space-y-8">
          <div className="rounded-xl bg-gray-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {t("contactInfoTitle")}
            </h3>

            <div className="space-y-4">
              {/* Email */}
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {t("emailInfoLabel")}
                  </p>
                  <a
                    href={`mailto:${t("contactEmail")}`}
                    className="text-sm text-orange-600 hover:underline"
                  >
                    {t("contactEmail")}
                  </a>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {t("phoneInfoLabel")}
                  </p>
                  <a
                    href={`tel:${t("phoneNumber").replace(/\s/g, "")}`}
                    className="text-sm text-orange-600 hover:underline"
                  >
                    {t("phoneNumber")}
                  </a>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {t("addressInfoLabel")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {settings.applicationName}
                    <br />
                    {t("addressStreet")}
                    <br />
                    {t("addressCity")}
                    <br />
                    {t("country")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Opening hours */}
          <div className="rounded-xl bg-gray-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {t("hoursTitle")}
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>{t("weekdays")}</span>
                <span>09:00 – 17:00</span>
              </div>
              <div className="flex justify-between">
                <span>{t("saturday")}</span>
                <span>10:00 – 14:00</span>
              </div>
              <div className="flex justify-between">
                <span>{t("sunday")}</span>
                <span>{t("closed")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

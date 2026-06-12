"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import {
  subscribeNewsletter,
  unsubscribeByEmail,
} from "../api/public-forms-api";
import {
  publicNewsletterSchema,
  publicUnsubscribeEmailSchema,
  type PublicNewsletterValues,
  type PublicUnsubscribeEmailValues,
} from "../schemas/public-newsletter.schema";

type Tab = "subscribe" | "unsubscribe";
type FormStatus = "idle" | "loading" | "success" | "error";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500";

/**
 * E28-S3: the public newsletter page (client island — DEC-2=A). Subscribe +
 * unsubscribe tabs, each an RHF+Zod form (E22 sub-recipe). The load-bearing
 * `firstName/lastName || undefined` coercion is applied at the call site so empty
 * names stay OUT of the request body. The subscribe/unsubscribe tab is component
 * state (NOT an RHF field); each tab has an independent form, so switching tabs
 * naturally clears the other tab's input. Behaviour-preserving vs `newsletter/page.tsx`.
 */
export default function NewsletterContent() {
  const t = useTranslations("newsletter");
  const { settings } = useAppSettings();

  const [tab, setTab] = useState<Tab>("subscribe");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const subscribeForm = useForm<PublicNewsletterValues>({
    resolver: zodResolver(publicNewsletterSchema),
    defaultValues: { email: "", firstName: "", lastName: "" },
  });
  const unsubscribeForm = useForm<PublicUnsubscribeEmailValues>({
    resolver: zodResolver(publicUnsubscribeEmailSchema),
    defaultValues: { email: "" },
  });

  const resetAll = () => {
    subscribeForm.reset();
    unsubscribeForm.reset();
    setStatus("idle");
    setErrorMsg("");
  };

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    resetAll();
  };

  const handleSubscribe = async (values: PublicNewsletterValues) => {
    setStatus("loading");
    setErrorMsg("");
    try {
      await subscribeNewsletter(
        values.email,
        values.firstName || undefined,
        values.lastName || undefined
      );
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(t("subscribeError"));
    }
  };

  const handleUnsubscribe = async (values: PublicUnsubscribeEmailValues) => {
    setStatus("loading");
    setErrorMsg("");
    try {
      await unsubscribeByEmail(values.email);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(t("unsubscribeError"));
    }
  };

  // Success state
  if (status === "success") {
    const isSubscribe = tab === "subscribe";
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div className="flex flex-col items-center justify-center rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-green-700">
            {isSubscribe ? t("subscribeSuccess") : t("unsubscribeSuccess")}
          </h2>
          <p className="mb-6 text-green-600">
            {isSubscribe
              ? t("subscribeSuccessText")
              : t("unsubscribeSuccessText")}
          </p>
          <button
            onClick={resetAll}
            className="font-medium text-orange-600 underline hover:text-orange-700"
          >
            {isSubscribe ? t("subscribeAnother") : t("unsubscribeAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      {/* Tab Toggle */}
      <div className="mb-8 flex overflow-hidden rounded-lg border border-gray-200">
        <button
          onClick={() => switchTab("subscribe")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            tab === "subscribe"
              ? "bg-orange-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {t("subscribeTitle")}
        </button>
        <button
          onClick={() => switchTab("unsubscribe")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            tab === "unsubscribe"
              ? "bg-orange-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {t("unsubscribeTitle")}
        </button>
      </div>

      {/* Subscribe Form */}
      {tab === "subscribe" && (
        <div className="rounded-xl bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <svg
                className="h-8 w-8 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("subscribeTitle")}
            </h1>
            <p className="mt-2 text-gray-600">
              {t("subscribeDescription", {
                organizationName: settings.applicationName,
              })}
            </p>
          </div>

          <form
            onSubmit={subscribeForm.handleSubmit(handleSubscribe)}
            noValidate
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("emailLabel")} *
              </label>
              <input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                className={inputClass}
                {...subscribeForm.register("email")}
              />
              {subscribeForm.formState.errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {t(
                    subscribeForm.formState.errors.email.message ??
                      "form.required"
                  )}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("firstNameLabel")}
                </label>
                <input
                  id="firstName"
                  type="text"
                  placeholder={t("firstNamePlaceholder")}
                  className={inputClass}
                  {...subscribeForm.register("firstName")}
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("lastNameLabel")}
                </label>
                <input
                  id="lastName"
                  type="text"
                  placeholder={t("lastNamePlaceholder")}
                  className={inputClass}
                  {...subscribeForm.register("lastName")}
                />
              </div>
            </div>

            {status === "error" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-orange-600 py-3 font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "loading" ? t("subscribing") : t("subscribeButton")}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            <button
              onClick={() => switchTab("unsubscribe")}
              className="text-orange-600 hover:underline"
            >
              {t("switchToUnsubscribe")}
            </button>
          </p>
        </div>
      )}

      {/* Unsubscribe Form */}
      {tab === "unsubscribe" && (
        <div className="rounded-xl bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg
                className="h-8 w-8 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("unsubscribeTitle")}
            </h1>
            <p className="mt-2 text-gray-600">{t("unsubscribeDescription")}</p>
          </div>

          <form
            onSubmit={unsubscribeForm.handleSubmit(handleUnsubscribe)}
            noValidate
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="unsub-email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("emailLabel")} *
              </label>
              <input
                id="unsub-email"
                type="email"
                placeholder={t("emailPlaceholder")}
                className={inputClass}
                {...unsubscribeForm.register("email")}
              />
              {unsubscribeForm.formState.errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {t(
                    unsubscribeForm.formState.errors.email.message ??
                      "form.required"
                  )}
                </p>
              )}
            </div>

            {status === "error" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-gray-600 py-3 font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "loading"
                ? t("unsubscribing")
                : t("unsubscribeButton")}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            <button
              onClick={() => switchTab("subscribe")}
              className="text-orange-600 hover:underline"
            >
              {t("switchToSubscribe")}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

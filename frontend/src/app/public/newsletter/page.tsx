"use client";

/**
 * REQ-029: Public newsletter subscribe/unsubscribe page.
 * Accessible without authentication — anyone can subscribe or unsubscribe
 * with just an email address.
 */

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { subscribeNewsletter, unsubscribeByEmail } from "@/lib/api/privacy";

type Tab = "subscribe" | "unsubscribe";
type FormStatus = "idle" | "loading" | "success" | "error";

export default function PublicNewsletterPage() {
  const t = useTranslations("newsletter");

  const [tab, setTab] = useState<Tab>("subscribe");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      await subscribeNewsletter(email, firstName || undefined, lastName || undefined);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(t("subscribeError"));
    }
  };

  const handleUnsubscribe = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      await unsubscribeByEmail(email);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(t("unsubscribeError"));
    }
  };

  const resetForm = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setStatus("idle");
    setErrorMsg("");
  };

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    resetForm();
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 py-2 px-4 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors";

  // Success state
  if (status === "success") {
    const isSubscribe = tab === "subscribe";
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div className="flex flex-col items-center justify-center rounded-xl bg-green-50 border border-green-200 p-8 text-center">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-green-700">
            {isSubscribe ? t("subscribeSuccess") : t("unsubscribeSuccess")}
          </h2>
          <p className="text-green-600 mb-6">
            {isSubscribe ? t("subscribeSuccessText") : t("unsubscribeSuccessText")}
          </p>
          <button
            onClick={resetForm}
            className="text-orange-600 hover:text-orange-700 font-medium underline"
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
      <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-8">
        <button
          onClick={() => switchTab("subscribe")}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            tab === "subscribe"
              ? "bg-orange-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {t("subscribeTitle")}
        </button>
        <button
          onClick={() => switchTab("unsubscribe")}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
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
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t("subscribeTitle")}</h1>
            <p className="text-gray-600 mt-2">{t("subscribeDescription")}</p>
          </div>

          <form onSubmit={handleSubscribe} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                {t("emailLabel")} *
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  {t("firstNameLabel")}
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t("firstNamePlaceholder")}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  {t("lastNameLabel")}
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t("lastNamePlaceholder")}
                  className={inputClass}
                />
              </div>
            </div>

            {status === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {status === "loading" ? t("subscribing") : t("subscribeButton")}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            <button onClick={() => switchTab("unsubscribe")} className="text-orange-600 hover:underline">
              {t("switchToUnsubscribe")}
            </button>
          </p>
        </div>
      )}

      {/* Unsubscribe Form */}
      {tab === "unsubscribe" && (
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t("unsubscribeTitle")}</h1>
            <p className="text-gray-600 mt-2">{t("unsubscribeDescription")}</p>
          </div>

          <form onSubmit={handleUnsubscribe} className="space-y-4">
            <div>
              <label htmlFor="unsub-email" className="block text-sm font-medium text-gray-700 mb-1">
                {t("emailLabel")} *
              </label>
              <input
                id="unsub-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className={inputClass}
              />
            </div>

            {status === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {status === "loading" ? t("unsubscribing") : t("unsubscribeButton")}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            <button onClick={() => switchTab("subscribe")} className="text-orange-600 hover:underline">
              {t("switchToSubscribe")}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * REQ-026: Neue E-Mail Kampagne erstellen
 */

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CreateEmailCampaignRequest,
  RecipientSegmentType,
  getSegmentTypeLabel,
} from "@/lib/api/email-campaigns";
import { RichTextEditor, HtmlSourceEditor } from "@/components/ui/rich-text-editor";

type EditorMode = "visual" | "html";

export default function NewEmailCampaignPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, accessToken } = useAuth();
  const router = useRouter();
  const t = useTranslations('emailCampaigns');
  const tCommon = useTranslations('common');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [formData, setFormData] = useState<CreateEmailCampaignRequest>({
    name: "",
    subject: "",
    htmlContent: "",
    plainTextContent: "",
    fromName: "IAB Connect",
    fromEmail: "noreply@iabconnect.ch",
    replyToEmail: "",
    segmentType: "AllActiveMembers",
    segmentFilter: "",
  });

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/email-campaigns`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('form.createError'));
      }

      const campaign = await response.json();
      router.push(`/communication/email-campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (authLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('loading')}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isVorstand && !isAdmin) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/communication/email-campaigns" className="text-gray-600 hover:text-gray-900 flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('backToCampaigns')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('form.newTitle')}</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Grunddaten */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">{t('form.basicInfo')}</h2>
                <p className="text-sm text-gray-500">{t('form.basicInfoDescription')}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('form.campaignName')} *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder={t('form.campaignNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('form.subject')} *
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder={t('form.subjectPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Absender */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">{t('form.sender')}</h2>
                <p className="text-sm text-gray-500">{t('form.senderDescription')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('form.senderName')} *
                </label>
                <input
                  type="text"
                  name="fromName"
                  value={formData.fromName}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('form.senderEmail')} *
                </label>
                <input
                  type="email"
                  name="fromEmail"
                  value={formData.fromEmail}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('form.replyToEmail')}
                </label>
                <input
                  type="email"
                  name="replyToEmail"
                  value={formData.replyToEmail}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder={t('form.replyToEmailPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Empfänger */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">{t('form.recipients')}</h2>
                <p className="text-sm text-gray-500">{t('form.recipientsDescription')}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('form.recipientGroup')} *
              </label>
              <select
                name="segmentType"
                value={formData.segmentType}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {(["AllActiveMembers", "NewsletterSubscribers", "EventParticipants", "Custom"] as RecipientSegmentType[]).map(
                  (type) => (
                    <option key={type} value={type}>
                      {getSegmentTypeLabel(type)}
                    </option>
                  )
                )}
              </select>
            </div>
            {formData.segmentType === "Custom" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('form.customFilter')}
                </label>
                <input
                  type="text"
                  name="segmentFilter"
                  value={formData.segmentFilter}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder={t('form.customFilterPlaceholder')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('form.customFilterHint')}
                </p>
              </div>
            )}
          </div>

          {/* Inhalt */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">{t('form.content')}</h2>
                  <p className="text-sm text-gray-500">{t('form.contentDescription')}</p>
                </div>
              </div>
              {/* Editor Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setEditorMode("visual")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    editorMode === "visual"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {t('form.visualMode')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode("html")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    editorMode === "html"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    {t('form.htmlMode')}
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                {editorMode === "visual" ? (
                  <RichTextEditor
                    content={formData.htmlContent}
                    onChange={(content) => setFormData((prev) => ({ ...prev, htmlContent: content }))}
                    placeholder={t('form.editorPlaceholder')}
                    minHeight="300px"
                  />
                ) : (
                  <HtmlSourceEditor
                    content={formData.htmlContent}
                    onChange={(content) => setFormData((prev) => ({ ...prev, htmlContent: content }))}
                    placeholder="<html>...</html>"
                    minHeight="300px"
                  />
                )}
                <div className="mt-2 p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">{t('form.availablePlaceholders')}:</span>{" "}
                    <code className="bg-gray-200 px-1 py-0.5 rounded text-orange-600">{"{{firstName}}"}</code>,{" "}
                    <code className="bg-gray-200 px-1 py-0.5 rounded text-orange-600">{"{{lastName}}"}</code>,{" "}
                    <code className="bg-gray-200 px-1 py-0.5 rounded text-orange-600">{"{{email}}"}</code>
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('form.plainTextVersion')}
                </label>
                <textarea
                  name="plainTextContent"
                  value={formData.plainTextContent}
                  onChange={handleChange}
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder={t('form.plainTextPlaceholder')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('form.plainTextHint')}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link
              href="/communication/email-campaigns"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {tCommon('cancel')}
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {loading ? t('form.creating') : t('form.createCampaign')}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

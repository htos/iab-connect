"use client";

/**
 * REQ-026: E-Mail Kampagne bearbeiten
 * Modern Edit Page with Rich Text Editor
 */

import { useAuth } from "@/lib/auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  UpdateEmailCampaignRequest,
  RecipientSegmentType,
  getSegmentTypeLabel,
  EmailCampaignDto,
} from "@/lib/api/email-campaigns";
import { RichTextEditor, HtmlSourceEditor } from "@/components/ui/rich-text-editor";

type EditorMode = "visual" | "html";

export default function EditEmailCampaignPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, accessToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<EmailCampaignDto | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [formData, setFormData] = useState<UpdateEmailCampaignRequest>({
    name: "",
    subject: "",
    htmlContent: "",
    plainTextContent: "",
    fromName: "",
    fromEmail: "",
    replyToEmail: "",
    segmentType: "AllActiveMembers",
    segmentFilter: "",
  });

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  const fetchCampaign = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/email-campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error("Kampagne nicht gefunden");
      }

      const data: EmailCampaignDto = await response.json();
      setCampaign(data);

      // Formular mit Kampagnendaten füllen
      setFormData({
        name: data.name,
        subject: data.subject,
        htmlContent: data.htmlContent || "",
        plainTextContent: data.plainTextContent || "",
        fromName: data.fromName || "IAB Connect",
        fromEmail: data.fromEmail || "noreply@iabconnect.ch",
        replyToEmail: data.replyToEmail || "",
        segmentType: data.segmentType as RecipientSegmentType,
        segmentFilter: data.segmentFilter || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [accessToken, baseUrl, campaignId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  useEffect(() => {
    if (accessToken && (isVorstand || isAdmin)) {
      fetchCampaign();
    }
  }, [accessToken, isVorstand, isAdmin, fetchCampaign]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/email-campaigns/${campaignId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Fehler beim Speichern der Kampagne");
      }

      router.push(`/email-campaigns/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laden...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isVorstand && !isAdmin) {
    return null;
  }

  // Nur Draft-Kampagnen können bearbeitet werden
  if (campaign && campaign.status !== "Draft") {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-xl shadow-sm">
            <h2 className="font-semibold mb-2">Bearbeitung nicht möglich</h2>
            <p>Diese Kampagne kann nicht mehr bearbeitet werden, da sie bereits versendet oder geplant wurde.</p>
            <Link
              href={`/email-campaigns/${campaignId}`}
              className="inline-block mt-4 text-orange-600 hover:underline"
            >
              Zurück zur Kampagne
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/email-campaigns/${campaignId}`} className="text-orange-600 hover:underline flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurück zur Kampagne
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Kampagne bearbeiten</h1>
          <p className="text-gray-500 mt-1">Bearbeiten Sie die Details Ihrer E-Mail-Kampagne</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 shadow-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
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
                <h2 className="text-lg font-semibold text-gray-900">Grunddaten</h2>
                <p className="text-sm text-gray-500">Name und Betreff der Kampagne</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kampagnenname *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="z.B. Newsletter Januar 2025"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Betreff *
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="E-Mail Betreff"
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
                <h2 className="text-lg font-semibold text-gray-900">Absender</h2>
                <p className="text-sm text-gray-500">Von wem soll die E-Mail kommen?</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Absendername *
                </label>
                <input
                  type="text"
                  name="fromName"
                  value={formData.fromName}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Absender-E-Mail *
                </label>
                <input
                  type="email"
                  name="fromEmail"
                  value={formData.fromEmail}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Antwort-E-Mail (optional)
                </label>
                <input
                  type="email"
                  name="replyToEmail"
                  value={formData.replyToEmail}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="Falls abweichend von Absender"
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
                <h2 className="text-lg font-semibold text-gray-900">Empfänger</h2>
                <p className="text-sm text-gray-500">An wen soll die E-Mail gesendet werden?</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Empfängergruppe *
              </label>
              <select
                name="segmentType"
                value={formData.segmentType}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
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
                  Filter (SQL-ähnlich)
                </label>
                <input
                  type="text"
                  name="segmentFilter"
                  value={formData.segmentFilter}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="z.B. membershipType = 'Regular'"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Verfügbare Felder: membershipType, status, memberSince
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
                  <h2 className="text-lg font-semibold text-gray-900">E-Mail-Inhalt</h2>
                  <p className="text-sm text-gray-500">Gestalten Sie Ihre E-Mail</p>
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
                    Visuell
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
                    HTML
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HTML-Inhalt *
                </label>
                {editorMode === "visual" ? (
                  <RichTextEditor
                    content={formData.htmlContent}
                    onChange={(content) => setFormData((prev) => ({ ...prev, htmlContent: content }))}
                    placeholder="Schreiben Sie hier Ihre E-Mail..."
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
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Verfügbare Platzhalter:</span>{" "}
                    <code className="bg-gray-200 px-1 py-0.5 rounded text-orange-600">{"{{firstName}}"}</code>,{" "}
                    <code className="bg-gray-200 px-1 py-0.5 rounded text-orange-600">{"{{lastName}}"}</code>,{" "}
                    <code className="bg-gray-200 px-1 py-0.5 rounded text-orange-600">{"{{email}}"}</code>
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plaintext-Version (optional)
                </label>
                <textarea
                  name="plainTextContent"
                  value={formData.plainTextContent}
                  onChange={handleChange}
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="Textversion für E-Mail-Clients ohne HTML-Unterstützung"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Wird automatisch aus dem HTML-Inhalt generiert, falls leer gelassen.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pb-8">
            <Link
              href={`/email-campaigns/${campaignId}`}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Änderungen speichern
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

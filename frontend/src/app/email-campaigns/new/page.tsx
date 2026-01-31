"use client";

/**
 * REQ-026: Neue E-Mail Kampagne erstellen
 */

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreateEmailCampaignRequest,
  RecipientSegmentType,
  getSegmentTypeLabel,
} from "@/lib/api/email-campaigns";

export default function NewEmailCampaignPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, accessToken } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        throw new Error(errorData.message || "Fehler beim Erstellen der Kampagne");
      }

      const campaign = await response.json();
      router.push(`/email-campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
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
            <p className="mt-4 text-gray-600">Laden...</p>
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
          <Link href="/email-campaigns" className="text-orange-600 hover:underline flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurück zu Kampagnen
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Neue E-Mail Kampagne</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Grunddaten */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Grunddaten</h2>
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
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
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
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  placeholder="E-Mail Betreff"
                />
              </div>
            </div>
          </div>

          {/* Absender */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Absender</h2>
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
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
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
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
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
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  placeholder="Falls abweichend von Absender"
                />
              </div>
            </div>
          </div>

          {/* Empfänger */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Empfänger</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Empfängergruppe *
              </label>
              <select
                name="segmentType"
                value={formData.segmentType}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-gray-900"
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
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  placeholder="z.B. membershipType = 'Regular'"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Verfügbare Felder: membershipType, status, memberSince
                </p>
              </div>
            )}
          </div>

          {/* Inhalt */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Inhalt</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTML-Inhalt *
                </label>
                <textarea
                  name="htmlContent"
                  value={formData.htmlContent}
                  onChange={handleChange}
                  required
                  rows={12}
                  className="w-full border rounded-lg px-3 py-2 text-gray-900 font-mono text-sm"
                  placeholder="<html>...</html>"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Verfügbare Platzhalter: {"{{firstName}}"}, {"{{lastName}}"}, {"{{email}}"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plaintext-Version (optional)
                </label>
                <textarea
                  name="plainTextContent"
                  value={formData.plainTextContent}
                  onChange={handleChange}
                  rows={6}
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  placeholder="Textversion für E-Mail-Clients ohne HTML-Unterstützung"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link
              href="/email-campaigns"
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Wird erstellt..." : "Kampagne erstellen"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

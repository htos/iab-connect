"use client";

/**
 * Create Segment Page
 * REQ-017: Segmentierung & Verteiler
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import {
  SegmentType,
  SegmentCriteria,
  CreateSegmentRequest,
  SEGMENT_COLORS,
  getSegmentColorClasses,
  PreviewResult,
} from "@/lib/api/member-segments";

export default function NewSegmentPage() {
  const t = useTranslations();
  const router = useRouter();
  const { isAuthenticated, isLoading, isAdmin, isVorstand } = useAuth();
  const api = useApiClient();

  const [formData, setFormData] = useState<CreateSegmentRequest>({
    name: "",
    segmentType: SegmentType.Static,
    description: "",
    criteriaJson: "",
    color: "orange",
  });

  const [criteria, setCriteria] = useState<SegmentCriteria>({
    status: [],
    type: [],
    memberSince: {},
    city: "",
    country: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!isLoading && isAuthenticated && !isAdmin && !isVorstand) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, isAdmin, isVorstand, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCriteriaStatusToggle = (status: string) => {
    setCriteria((prev) => ({
      ...prev,
      status: prev.status?.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...(prev.status ?? []), status],
    }));
  };

  const handleCriteriaTypeToggle = (type: string) => {
    setCriteria((prev) => ({
      ...prev,
      type: prev.type?.includes(type)
        ? prev.type.filter((t) => t !== type)
        : [...(prev.type ?? []), type],
    }));
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setError(null);
    const criteriaJson = JSON.stringify(criteria);
    const { data, error: apiError } = await api.post<PreviewResult>(
      "/api/v1/member-segments/preview",
      { criteriaJson }
    );
    if (apiError) {
      setError(apiError);
    } else if (data) {
      setPreview(data);
    }
    setPreviewing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: CreateSegmentRequest = {
      ...formData,
      criteriaJson:
        formData.segmentType === SegmentType.Dynamic
          ? JSON.stringify(criteria)
          : undefined,
    };

    const { error: apiError } = await api.post("/api/v1/member-segments", payload);
    if (apiError) {
      setError(apiError);
      setSaving(false);
    } else {
      router.push("/members/segments");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/members/segments"
            className="text-sm text-orange-600 hover:text-orange-800 mb-2 inline-flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("segments.title")}
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {t("segments.newSegment")}
          </h1>
          <p className="text-gray-600 mt-1">
            {t("segments.newSegmentDesc")}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("segments.section.basicInfo")}
            </h2>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                {t("segments.field.name")} *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                {t("segments.field.description")}
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label htmlFor="segmentType" className="block text-sm font-medium text-gray-700 mb-1">
                {t("segments.field.type")} *
              </label>
              <select
                id="segmentType"
                name="segmentType"
                value={formData.segmentType}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value={SegmentType.Static}>{t("segments.type.static")}</option>
                <option value={SegmentType.Dynamic}>{t("segments.type.dynamic")}</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.segmentType === SegmentType.Static
                  ? t("segments.typeHint.static")
                  : t("segments.typeHint.dynamic")}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("segments.field.color")}
              </label>
              <div className="flex flex-wrap gap-2">
                {SEGMENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, color }))}
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${getSegmentColorClasses(color)} ${
                      formData.color === color
                        ? "ring-2 ring-offset-2 ring-orange-500"
                        : ""
                    }`}
                  >
                    {formData.color === color && "✓"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Criteria */}
          {formData.segmentType === SegmentType.Dynamic && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("segments.section.criteria")}
              </h2>
              <p className="text-sm text-gray-500">
                {t("segments.criteriaDesc")}
              </p>

              {/* Status filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("segments.criteria.status")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {["Active", "Inactive", "Pending"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleCriteriaStatusToggle(status)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        criteria.status?.includes(status)
                          ? "bg-orange-100 border-orange-300 text-orange-800"
                          : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {t(`status.${status.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("segments.criteria.type")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {["Regular", "Student", "Honorary", "Family"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleCriteriaTypeToggle(type)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        criteria.type?.includes(type)
                          ? "bg-orange-100 border-orange-300 text-orange-800"
                          : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {t(`membershipType.${type.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Member since */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("segments.criteria.memberSinceFrom")}
                  </label>
                  <input
                    type="date"
                    value={criteria.memberSince?.from ?? ""}
                    onChange={(e) =>
                      setCriteria((prev) => ({
                        ...prev,
                        memberSince: { ...prev.memberSince, from: e.target.value || undefined },
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("segments.criteria.memberSinceTo")}
                  </label>
                  <input
                    type="date"
                    value={criteria.memberSince?.to ?? ""}
                    onChange={(e) =>
                      setCriteria((prev) => ({
                        ...prev,
                        memberSince: { ...prev.memberSince, to: e.target.value || undefined },
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* City / Country */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("segments.criteria.city")}
                  </label>
                  <input
                    type="text"
                    value={criteria.city ?? ""}
                    onChange={(e) =>
                      setCriteria((prev) => ({ ...prev, city: e.target.value || undefined }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("segments.criteria.country")}
                  </label>
                  <input
                    type="text"
                    value={criteria.country ?? ""}
                    onChange={(e) =>
                      setCriteria((prev) => ({ ...prev, country: e.target.value || undefined }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Preview Button */}
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing}
                className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
              >
                {previewing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                    {t("common.loading")}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {t("segments.action.preview")}
                  </>
                )}
              </button>

              {/* Preview Results */}
              {preview && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    {t("segments.previewResult", { count: preview.totalCount })}
                  </p>
                  {preview.preview.length > 0 && (
                    <ul className="space-y-1">
                      {preview.preview.map((m) => (
                        <li key={m.id} className="text-sm text-gray-700">
                          {m.firstName} {m.lastName} — {m.email}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href="/members/segments"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t("common.cancel")}
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("segments.action.create")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

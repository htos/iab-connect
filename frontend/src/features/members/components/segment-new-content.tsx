"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { SegmentForm } from "./segment-form";
import { useCreateSegment } from "../hooks/use-create-segment";
import { useSegmentPreview } from "../hooks/use-segment-preview";
import {
  SegmentType,
  type CreateSegmentRequest,
  type PreviewResult,
  type SegmentCriteria,
} from "../types/member-segment.types";
import type { SegmentFormValues } from "../schemas/segment.schema";

const EMPTY_VALUES: SegmentFormValues = {
  name: "",
  description: "",
  segmentType: SegmentType.Static,
  color: "orange",
  isActive: true,
};

const EMPTY_CRITERIA: SegmentCriteria = {
  status: [],
  type: [],
  memberSince: {},
  city: "",
  country: "",
};

/**
 * Create-segment composition root (E23-S4) — the only `"use client"` boundary for
 * `/members/segments/new`. Vorstand/Admin guard + create→redirect→list flow
 * preserved; the form is the shared RHF+Zod `SegmentForm`. The Dynamic-criteria
 * builder + preview live in the shared form; on submit the form hands back the
 * serialised `criteriaJson` (undefined for Static), matching the god-page payload.
 */
export function SegmentNewContent() {
  const router = useRouter();
  const t = useTranslations();
  const { isAuthenticated, isLoading, isAdmin, isVorstand } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const createMutation = useCreateSegment();
  const previewMutation = useSegmentPreview();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!isLoading && isAuthenticated && !isAdmin && !isVorstand) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, isAdmin, isVorstand, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
      </div>
    );
  }

  const handlePreview = (criteriaJson: string) => {
    setError(null);
    previewMutation.mutate(criteriaJson, {
      onSuccess: (data) => setPreview(data),
      onError: (err) => setError(err.message),
    });
  };

  const handleSubmit = (
    values: SegmentFormValues,
    criteriaJson: string | undefined
  ) => {
    setError(null);
    const payload: CreateSegmentRequest = {
      name: values.name,
      segmentType: values.segmentType,
      description: values.description,
      color: values.color,
      criteriaJson,
    };
    createMutation.mutate(payload, {
      onSuccess: () => router.push("/members/segments"),
      onError: (err) => setError(err.message),
    });
  };

  return (
    <PageShell maxWidth="2xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/members/segments"
          className="mb-2 inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("segments.title")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          {t("segments.newSegment")}
        </h1>
        <p className="mt-1 text-gray-600">{t("segments.newSegmentDesc")}</p>
      </div>

      <SegmentForm
        mode="create"
        defaultValues={EMPTY_VALUES}
        defaultCriteria={EMPTY_CRITERIA}
        onSubmit={handleSubmit}
        onPreview={handlePreview}
        preview={preview}
        previewing={previewMutation.isPending}
        submitIdleLabel="segments.action.create"
        submitPendingLabel="common.saving"
        pending={createMutation.isPending}
        errorMessage={error}
        cancelHref="/members/segments"
      />
    </PageShell>
  );
}

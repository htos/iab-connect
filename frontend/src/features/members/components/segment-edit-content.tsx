"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { SegmentForm } from "./segment-form";
import { useSegment } from "../hooks/use-segment";
import { useUpdateSegment } from "../hooks/use-update-segment";
import { useSegmentPreview } from "../hooks/use-segment-preview";
import {
  SegmentType,
  type MemberSegmentDto,
  type PreviewResult,
  type SegmentCriteria,
  type UpdateSegmentRequest,
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

function toFormValues(data: MemberSegmentDto): SegmentFormValues {
  return {
    name: data.name,
    description: data.description ?? "",
    segmentType: data.segmentType,
    color: data.color ?? "orange",
    isActive: data.isActive,
  };
}

function parseCriteria(criteriaJson?: string): SegmentCriteria {
  if (!criteriaJson) return EMPTY_CRITERIA;
  try {
    const parsed = JSON.parse(criteriaJson) as SegmentCriteria;
    return {
      status: parsed.status ?? [],
      type: parsed.type ?? [],
      memberSince: parsed.memberSince ?? {},
      city: parsed.city ?? "",
      country: parsed.country ?? "",
    };
  } catch {
    return EMPTY_CRITERIA;
  }
}

/**
 * Edit-segment composition root (E23-S4) — the only `"use client"` boundary for
 * `/members/segments/[id]/edit`. The GET prefill is a TanStack query
 * (`useSegment`); the form mounts only once loaded so `defaultValues` prefill
 * correctly. Segment TYPE is read-only on edit (`segments.typeNotEditable`);
 * `isActive` is edit-only; the Dynamic-criteria section renders only for a
 * Dynamic segment. Update→redirect to the detail page; criteriaJson is omitted
 * for a Static segment (god-page parity).
 */
export function SegmentEditContent() {
  const router = useRouter();
  const params = useParams();
  const segmentId = params.id as string;
  const t = useTranslations();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    isVorstand,
  } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!authLoading && isAuthenticated && !isAdmin && !isVorstand) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, isAdmin, isVorstand, router]);

  const enabled = isAuthenticated && (isAdmin || isVorstand);
  const { data: segment, isLoading: loading } = useSegment(segmentId, enabled);
  const updateMutation = useUpdateSegment(segmentId);
  const previewMutation = useSegmentPreview();

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
      </div>
    );
  }

  // A failed/absent load resolves `segment` to null (useSegment collapses 404 +
  // GET error). Render the not-found view (like the detail page) instead of a
  // blank editable form whose submit would PUT to a missing/forbidden id (CR-P2).
  if (!segment) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-2xl py-12 text-center">
          <p className="text-gray-500">{t("segments.notFound")}</p>
          <Link
            href="/members/segments"
            className="mt-4 inline-block text-orange-600 hover:text-orange-800"
          >
            {t("segments.backToList")}
          </Link>
        </div>
      </main>
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
    const payload: UpdateSegmentRequest = {
      name: values.name,
      description: values.description,
      color: values.color,
      isActive: values.isActive,
      criteriaJson,
    };
    updateMutation.mutate(payload, {
      onSuccess: () => router.push(`/members/segments/${segmentId}`),
      onError: (err) => setError(err.message),
    });
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/members/segments/${segmentId}`}
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
            {t("segments.backToDetail")}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("segments.editSegment")}
          </h1>
        </div>

        <SegmentForm
          mode="edit"
          defaultValues={segment ? toFormValues(segment) : EMPTY_VALUES}
          defaultCriteria={parseCriteria(segment?.criteriaJson)}
          onSubmit={handleSubmit}
          onPreview={handlePreview}
          preview={preview}
          previewing={previewMutation.isPending}
          submitIdleLabel="common.save"
          submitPendingLabel="common.saving"
          pending={updateMutation.isPending}
          errorMessage={error}
          cancelHref={`/members/segments/${segmentId}`}
        />
      </div>
    </main>
  );
}

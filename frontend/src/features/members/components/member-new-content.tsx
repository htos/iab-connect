"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import {
  findMemberDuplicates,
  type DuplicateCandidateDto,
} from "../api/member-duplicates";
import { DuplicateWarning } from "./duplicate-warning";
import { useCreateMember } from "../hooks/use-create-member";
import { MemberConflictError, MemberSaveError } from "../api/members-api";
import { MemberForm } from "./member-form";
import { MembershipType } from "../types/member.types";
import type { CreateMemberRequest } from "../types/member.types";
import type { MemberFormValues } from "../schemas/member.schema";

const EMPTY_VALUES: MemberFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  country: "Schweiz",
  membershipType: MembershipType.Regular,
};

/**
 * New-member composition root (E23-S2) — the only `"use client"` boundary for
 * `/members/new`. Vorstand/Admin guard + create→redirect→list flow preserved;
 * the form is the shared RHF+Zod sub-recipe. REQ-018 duplicate-detection is
 * preserved EXACTLY (A79): a single pre-flight `findMemberDuplicates` INSIDE
 * submit (fail-open), Exact hard-block, Likely gated behind `confirmedProceed`,
 * 409+existingMemberId synthesizing an Exact candidate. `<DuplicateWarning>` is
 * imported from its current path (S3 relocates it).
 */
export function MemberNewContent() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
    accessToken,
  } = useAuth();
  const router = useRouter();
  const t = useTranslations();
  const createMutation = useCreateMember();

  const [error, setError] = useState<string | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    DuplicateCandidateDto[]
  >([]);
  const [confirmedProceed, setConfirmedProceed] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);

  const hasExactMatch = duplicateCandidates.some(
    (c) => c.matchTier === "Exact"
  );
  const hasLikelyOnly = duplicateCandidates.length > 0 && !hasExactMatch;

  // Latest candidates for the stable handleWatch (A64/A78: a fresh callback would
  // re-fire the form's onWatch effect every render and clear the candidates).
  const candidatesRef = useRef(duplicateCandidates);
  candidatesRef.current = duplicateCandidates;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  // Any field change invalidates a stale candidate list (god-page handleChange).
  // Stable (useCallback) so the form's onWatch effect mounts once.
  const handleWatch = useCallback(() => {
    if (candidatesRef.current.length > 0) {
      setDuplicateCandidates([]);
      setConfirmedProceed(false);
    }
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (!isVorstand && !isAdmin)) {
    return null;
  }

  const handleSubmit = async (values: MemberFormValues) => {
    setError(null);

    // REQ-018 pre-flight (fail-open: a thrown check lets the POST proceed —
    // backend stays authoritative).
    setDuplicateLoading(true);
    let candidates: DuplicateCandidateDto[] = [];
    try {
      candidates = await findMemberDuplicates(accessToken ?? "", {
        email: values.email,
        phone: values.phone || undefined,
        firstName: values.firstName,
        lastName: values.lastName,
        postalCode: values.postalCode,
      });
    } catch (lookupErr) {
      console.error("Duplicate check failed", lookupErr);
    } finally {
      setDuplicateLoading(false);
    }
    setDuplicateCandidates(candidates);

    const isExact = candidates.some((c) => c.matchTier === "Exact");
    if (isExact) return;
    const isLikely = candidates.length > 0 && !isExact;
    if (isLikely && !confirmedProceed) return;

    const body: CreateMemberRequest = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      street: values.street,
      city: values.city,
      postalCode: values.postalCode,
      // Send raw values ("" when cleared), matching the god-page payload + the
      // suppliers slice; `|| undefined` would omit the field and diverge on
      // edit/clear (CR-P3).
      country: values.country,
      phone: values.phone,
      membershipType: values.membershipType,
    };

    createMutation.mutate(body, {
      onSuccess: () => router.push("/members"),
      onError: (err) => {
        if (err instanceof MemberConflictError) {
          setDuplicateCandidates([
            {
              id: err.existingMemberId,
              firstName: "",
              lastName: "",
              email: values.email,
              membershipStatus: "",
              memberSince: "",
              matchTier: "Exact",
              matchReason: "Email",
            },
          ]);
          setError(err.serverMessage ?? t("members.duplicateWarning.blocked"));
        } else if (err instanceof MemberSaveError) {
          setError(err.serverMessage ?? t("error.savingError"));
        } else {
          setError(err.message || t("error.errorOccurred"));
        }
      },
    });
  };

  const submitDisabled =
    createMutation.isPending ||
    hasExactMatch ||
    (hasLikelyOnly && !confirmedProceed);

  return (
    <PageShell maxWidth="2xl">
      <div className="mb-8">
        <Link
          href="/members"
          className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <svg
            className="h-5 w-5"
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
          {t("common.backToList")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          {t("members.newMember")}
        </h1>
        <p className="mt-1 text-gray-600">{t("members.addMemberDesc")}</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {(duplicateCandidates.length > 0 || duplicateLoading) && (
        <DuplicateWarning
          candidates={duplicateCandidates}
          hasExactMatch={hasExactMatch}
          confirmRequired={hasLikelyOnly}
          loading={duplicateLoading}
          onConfirmProceed={() => setConfirmedProceed(true)}
        />
      )}

      <MemberForm
        defaultValues={EMPTY_VALUES}
        showMembershipType
        onSubmit={handleSubmit}
        onWatch={handleWatch}
        submitIdleLabel="members.createMember"
        submitPendingLabel="members.creating"
        submitDisabled={submitDisabled}
        pending={createMutation.isPending}
      />
    </PageShell>
  );
}

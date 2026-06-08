"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  findMemberDuplicates,
  type DuplicateCandidateDto,
} from "@/lib/api/members";
import { DuplicateWarning } from "./duplicate-warning";
import { MemberNotFoundError, useMember } from "../hooks/use-member";
import { useUpdateMember } from "../hooks/use-update-member";
import { MemberConflictError, MemberSaveError } from "../api/members-api";
import { MemberForm } from "./member-form";
import { MembershipType } from "../types/member.types";
import type { MemberDto, UpdateMemberRequest } from "../types/member.types";
import type { MemberFormValues } from "../schemas/member.schema";

const EMPTY_VALUES: MemberFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  country: "",
  membershipType: MembershipType.Regular,
};

function toFormValues(data: MemberDto): MemberFormValues {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone ?? "",
    street: data.street,
    postalCode: data.postalCode,
    city: data.city,
    country: data.country ?? "",
    membershipType: data.membershipType ?? MembershipType.Regular,
  };
}

/**
 * Edit-member composition root (E23-S2) — the only `"use client"` boundary for
 * `/members/[id]/edit`. The GET prefill is a TanStack query (`useMember`, with
 * the 404 `MemberNotFoundError` sentinel); the form mounts only once loaded so
 * `defaultValues` prefill correctly. REQ-018 duplicate-detection preserved
 * EXACTLY (A79): a 350ms-debounced `AbortController` re-check with
 * `excludeMemberId` (NOT a pre-flight), Exact hard-block, Likely gated behind
 * `confirmedProceed`, 409+existingMemberId synthesis. NO membershipType field.
 */
export function MemberEditContent() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
    accessToken,
  } = useAuth();
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;
  const t = useTranslations();

  const [error, setError] = useState<string | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    DuplicateCandidateDto[]
  >([]);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [confirmedProceed, setConfirmedProceed] = useState(false);
  const [watched, setWatched] = useState<MemberFormValues | null>(null);

  const hasExactMatch = duplicateCandidates.some(
    (c) => c.matchTier === "Exact"
  );
  const hasLikelyOnly = duplicateCandidates.length > 0 && !hasExactMatch;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const enabled = isAuthenticated && (isVorstand || isAdmin);
  const {
    data: member,
    isLoading: loading,
    error: queryError,
  } = useMember(memberId, enabled);
  const updateMutation = useUpdateMember(memberId);

  // REQ-018 re-check on email / first / last / postalCode change, debounced
  // 350ms with an AbortController so racing requests can't overwrite fresher
  // state. `watched` is reported by the form (mount + change), so this also
  // fires once from the prefilled values (the god-page effect behaviour).
  useEffect(() => {
    if (!accessToken || !watched) return;
    if (!watched.email && !watched.firstName && !watched.lastName) return;

    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(async () => {
      setDuplicateLoading(true);
      try {
        const candidates = await findMemberDuplicates(
          accessToken,
          {
            email: watched.email,
            firstName: watched.firstName,
            lastName: watched.lastName,
            postalCode: watched.postalCode || undefined,
            excludeMemberId: memberId,
          },
          controller.signal
        );
        if (!cancelled) {
          setDuplicateCandidates(candidates);
          setConfirmedProceed(false);
        }
      } catch (lookupErr) {
        if (
          !cancelled &&
          (lookupErr as { name?: string })?.name !== "AbortError"
        ) {
          console.error("Duplicate re-check failed", lookupErr);
        }
      } finally {
        if (!cancelled) setDuplicateLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
    // Field-specific deps: re-run only when a duplicate-signal field changes,
    // NOT on every `watched` object identity change (mirrors the god-page's
    // formData.email/firstName/lastName/postalCode deps — A79).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accessToken,
    memberId,
    watched?.email,
    watched?.firstName,
    watched?.lastName,
    watched?.postalCode,
  ]);

  // Stable so the form's onWatch effect mounts once (A64/A78).
  const handleWatch = useCallback(
    (values: MemberFormValues) => setWatched(values),
    []
  );

  if (authLoading || loading) {
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

  // Load failure → full-page error view (distinct from the inline submit-error
  // banner). 404 → memberNotFound; any other → loadingError (god-page parity).
  if (queryError && !member) {
    const loadError =
      queryError instanceof MemberNotFoundError
        ? t("members.memberNotFound")
        : t("error.loadingError");
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
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
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h2 className="mb-2 text-xl font-semibold text-red-700">
              {t("common.error")}
            </h2>
            <p className="text-red-600">{loadError}</p>
          </div>
        </div>
      </main>
    );
  }

  const handleSubmit = (values: MemberFormValues) => {
    setError(null);
    if (hasExactMatch) return;
    if (hasLikelyOnly && !confirmedProceed) return;

    const body: UpdateMemberRequest = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      street: values.street,
      city: values.city,
      postalCode: values.postalCode,
      // Send raw values ("" when cleared), matching the god-page PUT payload; the
      // god-page sent "" to clear a field, so omitting via `|| undefined` would
      // change clear-on-edit semantics (CR-P3).
      country: values.country,
      phone: values.phone,
    };

    updateMutation.mutate(body, {
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
    updateMutation.isPending ||
    hasExactMatch ||
    (hasLikelyOnly && !confirmedProceed);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link
            href={`/members/${memberId}`}
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
            {t("common.backToMember")}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("members.editMember")}
          </h1>
          {member && (
            <p className="mt-1 text-gray-600">
              {member.firstName} {member.lastName}
            </p>
          )}
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
          defaultValues={member ? toFormValues(member) : EMPTY_VALUES}
          showMembershipType={false}
          onSubmit={handleSubmit}
          onWatch={handleWatch}
          submitIdleLabel="common.save"
          submitPendingLabel="common.saving"
          submitDisabled={submitDisabled}
          pending={updateMutation.isPending}
        />
      </div>
    </main>
  );
}

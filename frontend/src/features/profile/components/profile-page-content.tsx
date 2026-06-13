"use client";

/**
 * Self-Service Profile page content (E29-S4) — REQ-016: Mitglieder-
 * Selbstverwaltung. The single `"use client"` composition root for `/profile`.
 *
 * Behaviour preserved from the god-page (A79):
 *  - the guard matrix: `!isAuthenticated` → `/login`; authenticated-but-
 *    `!isMember` → `/`;
 *  - the `GET /api/v1/members/me` load (via `useProfile`, DEC-1=A useApiClient)
 *    with the loading spinner;
 *  - a 404 → the no-member-record view with the `isAdmin || isVorstand`-vs-member
 *    message + the `/profile/security` (always) and `/admin` (admin-only) links,
 *    VERBATIM;
 *  - the inline error notice for a non-404 load failure;
 *  - the view↔edit toggle, the `PUT /members/me` submit (success closes edit +
 *    updates the record; error surfaces the banner + stays in edit), and Cancel.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { PageShell, PageHeader } from "@/components/layout";
import {
  getMembershipStatusColor,
  getMembershipTypeColor,
  getStatusTranslationKey,
  getTypeTranslationKey,
} from "@/lib/api/members";
import { useProfile, NoMemberRecordError } from "../hooks/use-profile";
import { useUpdateProfile } from "../hooks/use-update-profile";
import { ProfileDetail } from "./profile-detail";
import { ProfileForm } from "./profile-form";
import type { ProfileFormValues } from "../schemas/profile.schema";
import type { MemberDto } from "../types/profile.types";

function toFormValues(member: MemberDto): ProfileFormValues {
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    street: member.street,
    city: member.city,
    postalCode: member.postalCode,
    country: member.country || "",
    phone: member.phone || "",
  };
}

export function ProfilePageContent() {
  const t = useTranslations();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isMember,
    isAdmin,
    isVorstand,
  } = useAuth();
  const router = useRouter();

  const gateOpen = isAuthenticated && isMember;
  const profileQuery = useProfile(!authLoading && gateOpen);
  const updateMutation = useUpdateProfile();

  const [editing, setEditing] = useState(false);

  // Guard matrix (god-page :149-159).
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!authLoading && isAuthenticated && !isMember) {
      router.push("/");
      return;
    }
  }, [authLoading, isAuthenticated, isMember, router]);

  const member = profileQuery.data ?? null;
  const isNoMemberRecord = profileQuery.error instanceof NoMemberRecordError;
  const loadErrorMessage =
    profileQuery.error && !isNoMemberRecord
      ? t((profileQuery.error as Error).message)
      : null;

  const handleSubmit = (values: ProfileFormValues) => {
    updateMutation.mutate(values, {
      onSuccess: () => setEditing(false),
    });
  };

  const handleCancel = () => {
    updateMutation.reset();
    setEditing(false);
  };

  if (authLoading || (gateOpen && profileQuery.isLoading)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isMember) {
    return null;
  }

  if (isNoMemberRecord && !member) {
    const showAdminLink = isAdmin || isVorstand;
    return (
      <PageShell maxWidth="2xl">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            {t("profile.noProfileTitle")}
          </h2>
          <p className="mb-6 text-gray-600">
            {showAdminLink
              ? t("profile.noProfileMessageAdmin")
              : t("profile.noProfileMessageMember")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile/security"
              className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
            >
              {t("profile.goToSecurity")}
            </Link>
            {showAdminLink && (
              <Link
                href="/admin"
                className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50"
              >
                {t("profile.goToAdmin")}
              </Link>
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  if (loadErrorMessage && !member) {
    return (
      <PageShell maxWidth="2xl">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="mb-2 text-xl font-semibold text-yellow-700">
            {t("error.notice")}
          </h2>
          <p className="text-yellow-600">{loadErrorMessage}</p>
        </div>
      </PageShell>
    );
  }

  if (!member) {
    return null;
  }

  const submitErrorMessage = editing
    ? (() => {
        const msg = updateMutation.error?.message;
        if (!msg) return null;
        // `error.savingError` is an i18n key; a server message is shown as-is.
        return msg === "error.savingError" ? t(msg) : msg;
      })()
    : null;

  return (
    <PageShell maxWidth="4xl">
      <PageHeader
        title={t("profile.title")}
        description={t("profile.managePersonalData")}
        actions={
          !editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              {t("common.edit")}
            </button>
          )
        }
      />

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <div className="md:col-span-1">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-orange-100">
                <span className="text-3xl font-bold text-orange-600">
                  {member.firstName[0]}
                  {member.lastName[0]}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {member.firstName} {member.lastName}
              </h2>
              <p className="mb-4 text-gray-500">{member.email}</p>

              <div className="flex flex-wrap justify-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${getMembershipStatusColor(member.status)}`}
                >
                  {t(`status.${getStatusTranslationKey(member.status)}`)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${getMembershipTypeColor(member.membershipType)}`}
                >
                  {t(
                    `membershipType.${getTypeTranslationKey(member.membershipType)}`
                  )}
                </span>
              </div>

              <p className="mt-4 text-sm text-gray-500">
                {t("profile.memberSince", {
                  date: new Date(member.memberSince).toLocaleDateString(
                    "de-CH",
                    {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    }
                  ),
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Details / Edit Form */}
        <div className="md:col-span-2">
          {editing ? (
            <>
              {submitErrorMessage && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-red-700">{submitErrorMessage}</p>
                </div>
              )}
              <ProfileForm
                defaultValues={toFormValues(member)}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                pending={updateMutation.isPending}
              />
            </>
          ) : (
            <ProfileDetail member={member} consentEnabled={gateOpen} />
          )}
        </div>
      </div>
    </PageShell>
  );
}

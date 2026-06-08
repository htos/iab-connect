"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useMember, MemberNotFoundError } from "../hooks/use-member";
import { useMemberDetailMutations } from "../hooks/use-member-detail-mutations";
import { useDeleteMember } from "../hooks/use-delete-member";
import { MemberStatusBadge } from "./member-status-badge";
import { MemberTypeBadge } from "./member-type-badge";
import { DeleteMemberDialog } from "./delete-member-dialog";
import { MembershipStatus, MembershipType } from "../types/member.types";

/**
 * Member detail composition root (E23-S2) — the only `"use client"` boundary for
 * `/members/[id]`. The GET is a TanStack query (`use-member`, which throws
 * `MemberNotFoundError` on a 404 so the dedicated not-found view renders, vs the
 * generic full-page error). Status + type quick-changes are `useMutation`s
 * (`use-member-detail-mutations`) that write the returned `MemberDto` back into
 * the detail cache (no extra GET, A79); their errors still surface via `alert`,
 * exactly as the god-page did (that mechanism is not licensed to change). Delete
 * is admin-only and now uses the accessible `DeleteMemberDialog` (the licensed
 * A79 change from `confirm()`/`alert()`); on success it redirects to /members,
 * on failure it surfaces the error and stays on the page.
 */
export function MemberDetail() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;
  const t = useTranslations();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
      return;
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const {
    data: member,
    isLoading: loading,
    error: queryError,
  } = useMember(memberId, isAuthenticated && (isVorstand || isAdmin));
  const mutations = useMemberDetailMutations(memberId);
  const deleteMutation = useDeleteMember();

  const handleStatusChange = (newStatus: MembershipStatus) => {
    mutations.changeStatus.mutate(newStatus, {
      onError: () => alert(t("error.updatingError")),
    });
  };

  const handleTypeChange = (newType: MembershipType) => {
    mutations.changeType.mutate(newType, {
      onError: () => alert(t("error.updatingError")),
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(memberId, {
      onSuccess: () => router.push("/members"),
      onError: () => {
        setShowDeleteDialog(false);
        alert(t("error.deletingError"));
      },
    });
  };

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

  // Only surface the full-page error/not-found view when there is NO cached
  // member — i.e. the initial load failed. A transient background-refetch error
  // (window-focus refetch) keeps `member` in cache, so we keep rendering it
  // rather than blowing the view away (matches member-edit-content; CR-P1).
  if (queryError && !member) {
    const isNotFound = queryError instanceof MemberNotFoundError;
    const message = isNotFound
      ? t("members.memberNotFound")
      : queryError.message;
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
            <p className="text-red-600">{message}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
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
              {member.firstName} {member.lastName}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/members/${memberId}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50"
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
            </Link>
            {isAdmin && (
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-red-700 transition-colors hover:bg-red-200"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                {t("common.delete")}
              </button>
            )}
          </div>
        </div>

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
                  <MemberStatusBadge status={member.status} size="md" />
                  <MemberTypeBadge type={member.membershipType} size="md" />
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6 md:col-span-2">
            {/* Contact Info */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                {t("members.contactDetails")}
              </h3>
              <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t("members.email")}
                  </dt>
                  <dd className="mt-1">
                    <a
                      href={`mailto:${member.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {member.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t("members.phone")}
                  </dt>
                  <dd className="mt-1">
                    {member.phone ? (
                      <a
                        href={`tel:${member.phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {member.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Address */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                {t("members.address")}
              </h3>
              <address className="text-gray-700 not-italic">
                {member.street}
                <br />
                {member.postalCode} {member.city}
                <br />
                {member.country}
              </address>
            </div>

            {/* Membership Info */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                {t("members.membership")}
              </h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t("members.memberSince")}
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {new Date(member.memberSince).toLocaleDateString("de-CH", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                {t("members.quickActions")}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {t("members.changeStatus")}
                  </label>
                  <select
                    value={member.status}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as MembershipStatus)
                    }
                    disabled={mutations.changeStatus.isPending}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  >
                    <option value={MembershipStatus.Pending}>
                      {t("status.pending")}
                    </option>
                    <option value={MembershipStatus.Active}>
                      {t("status.active")}
                    </option>
                    <option value={MembershipStatus.Inactive}>
                      {t("status.inactive")}
                    </option>
                    <option value={MembershipStatus.Suspended}>
                      {t("status.suspended")}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {t("members.changeType")}
                  </label>
                  <select
                    value={member.membershipType}
                    onChange={(e) =>
                      handleTypeChange(e.target.value as MembershipType)
                    }
                    disabled={mutations.changeType.isPending}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  >
                    <option value={MembershipType.Regular}>
                      {t("membershipType.regular")}
                    </option>
                    <option value={MembershipType.Student}>
                      {t("membershipType.student")}
                    </option>
                    <option value={MembershipType.Family}>
                      {t("membershipType.family")}
                    </option>
                    <option value={MembershipType.Honorary}>
                      {t("membershipType.honorary")}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeleteMemberDialog
        target={
          showDeleteDialog
            ? {
                id: memberId,
                name: `${member.firstName} ${member.lastName}`,
              }
            : null
        }
        pending={deleteMutation.isPending}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setShowDeleteDialog(false);
        }}
      />
    </main>
  );
}

"use client";

/**
 * Member Detail Page - REQ-016: Mitgliederprofil
 */

import { useAuth } from "@/lib/auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  MemberDto,
  MembershipStatus,
  MembershipType,
  getMembershipStatusColor,
  getMembershipTypeColor,
  getStatusTranslationKey,
  getTypeTranslationKey,
} from "@/lib/api/members";

export default function MemberDetailPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, accessToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;
  const t = useTranslations();

  const [member, setMember] = useState<MemberDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  const fetchMember = useCallback(async () => {
    if (!accessToken || !memberId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/members/${memberId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 404) {
        setError(t("members.memberNotFound"));
        return;
      }

      if (!response.ok) {
        throw new Error(t("error.loadingError"));
      }

      const data: MemberDto = await response.json();
      setMember(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.errorOccurred"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, baseUrl, memberId, t]);

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

  useEffect(() => {
    if (isAuthenticated && (isVorstand || isAdmin)) {
      fetchMember();
    }
  }, [isAuthenticated, isVorstand, isAdmin, fetchMember]);

  const handleStatusChange = async (newStatus: MembershipStatus) => {
    if (!member) return;

    setStatusUpdating(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/members/${memberId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(t("error.updatingError"));
      }

      const updatedMember = await response.json();
      setMember(updatedMember);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("error.updatingError"));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleTypeChange = async (newType: MembershipType) => {
    if (!member) return;

    setStatusUpdating(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/members/${memberId}/type`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ membershipType: newType }),
      });

      if (!response.ok) {
        throw new Error(t("error.updatingError"));
      }

      const updatedMember = await response.json();
      setMember(updatedMember);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("error.updatingError"));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!member) return;
    if (!confirm(t("members.deleteConfirm", { name: `${member.firstName} ${member.lastName}` }))) return;

    try {
      const response = await fetch(`${baseUrl}/api/v1/members/${memberId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(t("error.deletingError"));
      }

      router.push("/members");
    } catch (err) {
      alert(err instanceof Error ? err.message : t("error.deletingError"));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (!isVorstand && !isAdmin)) {
    return null;
  }

  if (error) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/members"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("common.backToList")}
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-red-700 mb-2">{t("common.error")}</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <Link
              href="/members"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t("common.backToList")}
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {member.firstName} {member.lastName}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/members/${memberId}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t("common.edit")}
            </Link>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t("common.delete")}
            </button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-24 w-24 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl font-bold text-orange-600">
                    {member.firstName[0]}{member.lastName[0]}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {member.firstName} {member.lastName}
                </h2>
                <p className="text-gray-500 mb-4">{member.email}</p>

                <div className="flex flex-wrap gap-2 justify-center">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getMembershipStatusColor(member.status)}`}>
                    {t(`status.${getStatusTranslationKey(member.status)}`)}
                  </span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getMembershipTypeColor(member.membershipType)}`}>
                    {t(`membershipType.${getTypeTranslationKey(member.membershipType)}`)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("members.contactDetails")}</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("members.email")}</dt>
                  <dd className="mt-1">
                    <a href={`mailto:${member.email}`} className="text-blue-600 hover:underline">
                      {member.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("members.phone")}</dt>
                  <dd className="mt-1">
                    {member.phone ? (
                      <a href={`tel:${member.phone}`} className="text-blue-600 hover:underline">
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
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("members.address")}</h3>
              <address className="not-italic text-gray-700">
                {member.street}<br />
                {member.postalCode} {member.city}<br />
                {member.country}
              </address>
            </div>

            {/* Membership Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("members.membership")}</h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("members.memberSince")}</dt>
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
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("members.quickActions")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("members.changeStatus")}
                  </label>
                  <select
                    value={member.status}
                    onChange={(e) => handleStatusChange(e.target.value as MembershipStatus)}
                    disabled={statusUpdating}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
                  >
                    <option value={MembershipStatus.Pending}>{t("status.pending")}</option>
                    <option value={MembershipStatus.Active}>{t("status.active")}</option>
                    <option value={MembershipStatus.Inactive}>{t("status.inactive")}</option>
                    <option value={MembershipStatus.Suspended}>{t("status.suspended")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("members.changeType")}
                  </label>
                  <select
                    value={member.membershipType}
                    onChange={(e) => handleTypeChange(e.target.value as MembershipType)}
                    disabled={statusUpdating}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
                  >
                    <option value={MembershipType.Regular}>{t("membershipType.regular")}</option>
                    <option value={MembershipType.Student}>{t("membershipType.student")}</option>
                    <option value={MembershipType.Family}>{t("membershipType.family")}</option>
                    <option value={MembershipType.Honorary}>{t("membershipType.honorary")}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

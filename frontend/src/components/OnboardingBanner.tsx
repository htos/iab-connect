"use client";

/**
 * REQ-007: Onboarding Banner Component
 * Shows profile completion status and guides users through onboarding
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface ProfileChecklistItem {
  key: string;
  label: string;
  isComplete: boolean;
  isRequired: boolean;
}

interface ProfileStatus {
  isComplete: boolean;
  completionPercentage: number;
  hasProfile: boolean;
  checklistItems: ProfileChecklistItem[];
  nextAction: string | null;
  profileUrl: string;
}

export function OnboardingBanner() {
  const t = useTranslations();
  const { isAuthenticated, isMember, accessToken } = useAuth();
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  // Use ref to track if we've already fetched
  const hasFetched = useRef(false);
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const fetchProfileStatus = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/v1/members/me/profile-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data: ProfileStatus = await response.json();
        setProfileStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch profile status:", error);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    // Check localStorage for dismissed state
    const dismissedUntil = localStorage.getItem("onboarding-dismissed-until");
    if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    if (isAuthenticated && isMember && !hasFetched.current) {
      hasFetched.current = true;
      fetchProfileStatus();
    } else if (!isAuthenticated || !isMember) {
      setLoading(false);
    }
  }, [isAuthenticated, isMember, fetchProfileStatus]);

  const handleDismiss = () => {
    // Dismiss for 24 hours
    const dismissUntil = new Date();
    dismissUntil.setHours(dismissUntil.getHours() + 24);
    localStorage.setItem("onboarding-dismissed-until", dismissUntil.toISOString());
    setDismissed(true);
  };

  // Don't show if loading, dismissed, or profile is complete
  if (loading || dismissed || !profileStatus || profileStatus.isComplete) {
    return null;
  }

  return (
    <div className="bg-linear-to-r from-orange-500 to-amber-500 rounded-xl shadow-lg p-4 md:p-6 mb-6 relative">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors"
        title={t("common.dismiss")}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Icon and Title */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-full">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {t("onboarding.completeProfile")}
            </h3>
            <p className="text-white/80 text-sm">
              {profileStatus.completionPercentage}% {t("onboarding.complete")}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 md:mx-4">
          <div className="h-3 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${profileStatus.completionPercentage}%` }}
            />
          </div>
          {/* Checklist */}
          <div className="mt-2 flex flex-wrap gap-2">
            {profileStatus.checklistItems.map((item) => (
              <span
                key={item.key}
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                  item.isComplete
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-white/70"
                }`}
              >
                {item.isComplete ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                  </svg>
                )}
                {item.label}
                {item.isRequired && !item.isComplete && (
                  <span className="text-yellow-200">*</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <Link
          href={profileStatus.profileUrl}
          className="inline-flex items-center justify-center gap-2 bg-white text-orange-600 font-semibold px-6 py-2.5 rounded-lg hover:bg-orange-50 transition-colors shrink-0"
        >
          {t("onboarding.completeNow")}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Next Action Hint */}
      {profileStatus.nextAction && (
        <p className="mt-3 text-white/80 text-sm italic">
          💡 {profileStatus.nextAction}
        </p>
      )}
    </div>
  );
}

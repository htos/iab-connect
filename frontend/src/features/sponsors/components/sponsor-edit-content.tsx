"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useSponsor } from "../hooks/use-sponsor";
import { useUpdateSponsor } from "../hooks/use-update-sponsor";
import { SponsorForm } from "./sponsor-form";
import type { SponsorFormValues } from "../schemas/sponsor.schema";
import type { SponsorDetailDto } from "../types/sponsor.types";

function toFormValues(data: SponsorDetailDto): SponsorFormValues {
  return {
    companyName: data.companyName,
    contactPerson: data.contactPerson ?? "",
    tier: data.tier,
    email: data.email ?? "",
    phone: data.phone ?? "",
    website: data.website ?? "",
    agreementStart: data.agreementStart ?? "",
    agreementEnd: data.agreementEnd ?? "",
    notes: data.notes ?? "",
  };
}

/**
 * Edit-sponsor composition root (E22-S3) — the only `"use client"` boundary for
 * the `/sponsors/[id]/edit` route. The GET prefill is now a TanStack query
 * (`use-sponsor`); the form mounts only once the data has loaded so its
 * `defaultValues` prefill the fields (the god-page's GET→setFormData behaviour).
 * Same auth guard, update→redirect→list flow, and API-error banner.
 */
export function SponsorEditContent() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sponsorId = params.id as string;
  const t = useTranslations();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin)
      router.push("/");
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const {
    data: sponsor,
    isLoading: loading,
    error: queryError,
  } = useSponsor(sponsorId, isAuthenticated && (isVorstand || isAdmin));
  const updateMutation = useUpdateSponsor(sponsorId);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!isAuthenticated || (!isVorstand && !isAdmin)) return null;

  const handleSubmit = (values: SponsorFormValues) => {
    updateMutation.mutate(values, {
      onSuccess: () => router.push("/sponsors"),
    });
  };

  const errorMessage =
    updateMutation.error?.message ?? queryError?.message ?? null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link
            href="/sponsors"
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
            {t("sponsors.editSponsor")}
          </h1>
        </div>

        <SponsorForm
          defaultValues={sponsor ? toFormValues(sponsor) : EMPTY_VALUES}
          onSubmit={handleSubmit}
          submitLabel="common.save"
          pending={updateMutation.isPending}
          errorMessage={errorMessage}
        />
      </div>
    </main>
  );
}

const EMPTY_VALUES: SponsorFormValues = {
  companyName: "",
  contactPerson: "",
  tier: "Bronze",
  email: "",
  phone: "",
  website: "",
  agreementStart: "",
  agreementEnd: "",
  notes: "",
};

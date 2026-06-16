"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { useCreateSponsor } from "../hooks/use-create-sponsor";
import { SponsorForm } from "./sponsor-form";
import type { SponsorFormValues } from "../schemas/sponsor.schema";

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

/**
 * New-sponsor composition root (E22-S3) — the only `"use client"` boundary for
 * the `/sponsors/new` route. Same auth guard + redirect + create→redirect→list
 * flow as the god-page; the form mechanism is now the shared RHF+Zod sub-recipe.
 */
export function SponsorNewContent() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const t = useTranslations();
  const createMutation = useCreateSponsor();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin)
      router.push("/");
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!isAuthenticated || (!isVorstand && !isAdmin)) return null;

  const handleSubmit = (values: SponsorFormValues) => {
    createMutation.mutate(values, {
      onSuccess: () => router.push("/sponsors"),
    });
  };

  return (
    <PageShell maxWidth="2xl">
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
          {t("sponsors.newSponsor")}
        </h1>
        <p className="mt-1 text-gray-600">{t("sponsors.addSponsorDesc")}</p>
      </div>

      <SponsorForm
        defaultValues={EMPTY_VALUES}
        onSubmit={handleSubmit}
        submitLabel="sponsors.createSponsor"
        pending={createMutation.isPending}
        errorMessage={createMutation.error?.message ?? null}
      />
    </PageShell>
  );
}

"use client";

/**
 * Create-email-campaign page content (REQ-026, E25-S3). Thin client composition
 * root rendered by `new/page.tsx`. Owns the auth gate, the create mutation +
 * redirect, and the REQ-086 AppSettings race-guard inputs; the shared
 * `EmailCampaignForm` owns the fields/validation/segment-search/editor toggle.
 *
 * Behaviour preserved (pinned by the E25-S1 create net): the /login + / redirects,
 * the auth-loading spinner, the POST-then-`router.push(/.../${id})`, the create
 * error banner (server message), and the REQ-086 sender-name default + submit
 * race-guard (the form receives `settingsLoading` + `applicationName` and applies
 * the god-page's post-settings default-when-empty + disabled-while-loading logic).
 * The neutral `noreply@example.org` default is baked into the form defaults.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import { EmailCampaignForm } from "./email-campaign-form";
import { useCreateEmailCampaign } from "../hooks/use-create-email-campaign";
import type { EmailCampaignFormValues } from "../schemas/email-campaign.schema";
import type { CreateEmailCampaignRequest } from "../types/email-campaign.types";

const CREATE_DEFAULTS: EmailCampaignFormValues = {
  name: "",
  subject: "",
  htmlContent: "",
  plainTextContent: "",
  fromName: "",
  // REQ-086 (E9 review patch): neutral placeholder — no hardcoded org domain.
  fromEmail: "noreply@example.org",
  replyToEmail: "",
  segmentType: "AllActiveMembers",
  segmentFilter: "",
};

export function EmailCampaignNewContent() {
  const t = useTranslations("emailCampaigns");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const { settings, isLoading: settingsLoading } = useAppSettings();
  const createMutation = useCreateEmailCampaign();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const handleSubmit = (body: CreateEmailCampaignRequest) => {
    createMutation.mutate(body, {
      onSuccess: (campaign) =>
        router.push(`/communication/email-campaigns/${campaign.id}`),
    });
  };

  if (authLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
            <p className="mt-4 text-gray-600">{t("loading")}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isVorstand && !isAdmin) {
    return null;
  }

  return (
    <EmailCampaignForm
      mode="create"
      defaultValues={CREATE_DEFAULTS}
      onSubmit={handleSubmit}
      pending={createMutation.isPending}
      errorMessage={createMutation.error?.message ?? null}
      settingsLoading={settingsLoading}
      applicationName={settings.applicationName}
      cancelHref="/communication/email-campaigns"
      backHref="/communication/email-campaigns"
      backLabelKey="backToCampaigns"
    />
  );
}

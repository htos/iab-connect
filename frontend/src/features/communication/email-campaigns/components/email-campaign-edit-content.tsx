"use client";

/**
 * Edit-email-campaign page content (REQ-026, E25-S3). Thin client composition root
 * rendered by `[id]/edit/page.tsx`. KEEPS `useParams()` inside the slice (the S1
 * spec mocks `next/navigation.useParams`) so the route entry stays trivial. Owns
 * the auth gate, the detail load, the Draft-only guard, the REQ-086 ref, the
 * default-value build, and the update mutation + redirect; the shared
 * `EmailCampaignForm` owns the fields/validation/segment-search/editor toggle.
 *
 * Behaviour preserved (pinned by the E25-S1 edit net):
 *   - /login + / redirects; the load + auth spinner;
 *   - the campaign loads by id, prefilling the form (name/subject/... );
 *   - a non-Draft campaign renders the `editNotPossible` notice instead of the form;
 *   - the PUT-then-`router.push(detail)`; the save error banner (server message);
 *   - the load-error banner (a failed GET leaves the form rendered — campaign stays
 *     null, NOT the editNotPossible branch — with the `form.loadError` banner);
 *   - REQ-086: `fromName` falls back to `settings.applicationName` ONLY when the
 *     loaded campaign's value is empty; the no-clobber guarantee the god-page got
 *     from a ref is now provided STRUCTURALLY by RHF (the form captures
 *     `defaultValues` once at mount — a later AppSettings re-render rebuilds the
 *     prop but RHF ignores it, so unsaved edits are never reset). The neutral
 *     `noreply@example.org` default is baked into the build below.
 */

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import { EmailCampaignForm } from "./email-campaign-form";
import { useEmailCampaign } from "../hooks/use-email-campaign";
import { useUpdateEmailCampaign } from "../hooks/use-update-email-campaign";
import { SEGMENT_TYPE_OPTIONS } from "../schemas/email-campaign.schema";
import type { EmailCampaignFormValues } from "../schemas/email-campaign.schema";
import type {
  CreateEmailCampaignRequest,
  EmailCampaignDto,
  RecipientSegmentType,
} from "../types/email-campaign.types";

const FORM_SEGMENT_TYPES = SEGMENT_TYPE_OPTIONS as readonly string[];

/**
 * Build the form defaults from the loaded campaign (god-page parity). `fromName`
 * falls back to the configured org name when the campaign value is empty;
 * `fromEmail` to the neutral `noreply@example.org` placeholder; a `segmentType`
 * outside the form's 5 options falls back to the default (the old `<select>`
 * simply showed no matching option).
 */
function buildDefaultValues(
  campaign: EmailCampaignDto,
  applicationName: string
): EmailCampaignFormValues {
  const segmentType = FORM_SEGMENT_TYPES.includes(campaign.segmentType)
    ? (campaign.segmentType as RecipientSegmentType)
    : "AllActiveMembers";
  return {
    name: campaign.name,
    subject: campaign.subject,
    htmlContent: campaign.htmlContent || "",
    plainTextContent: campaign.plainTextContent || "",
    fromName: campaign.fromName || applicationName,
    fromEmail: campaign.fromEmail || "noreply@example.org",
    replyToEmail: campaign.replyToEmail || "",
    segmentType: segmentType as EmailCampaignFormValues["segmentType"],
    segmentFilter: campaign.segmentFilter || "",
  };
}

export function EmailCampaignEditContent() {
  const t = useTranslations("emailCampaigns");
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const { settings } = useAppSettings();

  const authorized = isVorstand || isAdmin;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const {
    data: campaign,
    isLoading: queryLoading,
    isError,
  } = useEmailCampaign(campaignId, isAuthenticated && authorized);

  const updateMutation = useUpdateEmailCampaign();

  const handleSubmit = (body: CreateEmailCampaignRequest) => {
    updateMutation.mutate(
      { id: campaignId, body },
      {
        onSuccess: () =>
          router.push(`/communication/email-campaigns/${campaignId}`),
      }
    );
  };

  // Auth + load spinner (god-page: `authLoading || loading`).
  if (authLoading || (authorized && queryLoading)) {
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

  // Only Draft campaigns can be edited (god-page: `campaign && status !== Draft`).
  if (campaign && campaign.status !== "Draft") {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-6 py-4 text-yellow-800 shadow-sm">
            <h2 className="mb-2 font-semibold">{t("form.editNotPossible")}</h2>
            <p>{t("form.editNotPossibleReason")}</p>
            <Link
              href={`/communication/email-campaigns/${campaignId}`}
              className="mt-4 inline-block text-gray-600 hover:text-gray-900"
            >
              {t("backToCampaign")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // god-page parity: on a failed GET the campaign stays null (NOT editNotPossible)
  // and the form renders with the `form.loadError` banner. The update error takes
  // precedence over the load error in the banner. `settings.applicationName` is
  // read directly (no ref): RHF captures these defaults once at form mount, so a
  // later AppSettings re-render rebuilding this object never resets unsaved edits.
  const defaultValues = campaign
    ? buildDefaultValues(campaign, settings.applicationName)
    : buildDefaultValues(
        {
          name: "",
          subject: "",
          htmlContent: "",
          plainTextContent: "",
          fromName: "",
          fromEmail: "",
          replyToEmail: "",
          segmentType: "AllActiveMembers",
          segmentFilter: "",
          status: "Draft",
        } as EmailCampaignDto,
        settings.applicationName
      );

  const bannerError =
    updateMutation.error?.message ?? (isError ? t("form.loadError") : null);

  return (
    <EmailCampaignForm
      mode="edit"
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      pending={updateMutation.isPending}
      errorMessage={bannerError}
      cancelHref={`/communication/email-campaigns/${campaignId}`}
      backHref={`/communication/email-campaigns/${campaignId}`}
      backLabelKey="backToCampaign"
    />
  );
}

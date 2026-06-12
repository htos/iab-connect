"use client";

/**
 * Edit-automation page content (E25-S2). Rendered by `[id]/edit/page.tsx` with the
 * `id` resolved from `use(params)`. Loads the automation via the `use-automation`
 * detail query (retry:false — god-page parity), shows a spinner while loading and
 * an error panel on failure, then renders the shared `AutomationForm` in edit mode
 * pre-populated with the loaded values. Owns the update mutation + redirect.
 */

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { AutomationForm, buildDefaultValues } from "./automation-form";
import { useAutomation } from "../hooks/use-automation";
import { useUpdateAutomation } from "../hooks/use-update-automation";
import type { AutomationWriteRequest } from "../types/automation.types";

export function AutomationEditContent({ id }: { id: string }) {
  const t = useTranslations("automations");
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuth();

  // Gate the FETCH on the token only (god-page parity): a non-privileged authed
  // user direct-navving still fetches and gets a backend 403 → error panel,
  // rather than a role-gated `enabled=false` that never runs the query and falls
  // through to a permanent spinner.
  const { data: automation, isError } = useAutomation(
    id,
    isAuthenticated && !!accessToken
  );
  const updateMutation = useUpdateAutomation();

  const handleSubmit = (body: AutomationWriteRequest) => {
    updateMutation.mutate(
      { id, body },
      {
        onSuccess: (result) =>
          router.push(`/communication/automations/${result.id}`),
      }
    );
  };

  if (isError && !automation) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {t("loadError")}
        </div>
      </main>
    );
  }

  if (!automation) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <AutomationForm
      mode="edit"
      defaultValues={buildDefaultValues(automation)}
      onSubmit={handleSubmit}
      pending={updateMutation.isPending}
      errorMessage={updateMutation.error?.message ?? null}
    />
  );
}

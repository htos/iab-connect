"use client";

/** REQ-028 (E5-S3): edit an automation definition (structural edit obeys S1's status rules). */

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { AutomationDetailDto, getAutomation } from "@/lib/api/automations";
import AutomationForm from "../../AutomationForm";

export default function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("automations");
  const { accessToken } = useAuth();
  const [automation, setAutomation] = useState<AutomationDetailDto | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getAutomation(accessToken, id)
      .then(setAutomation)
      .catch(() => setError(t("loadError")));
  }, [accessToken, id, t]);

  if (error) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
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

  return <AutomationForm mode="edit" initial={automation} />;
}

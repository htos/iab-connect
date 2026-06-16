"use client";

/**
 * Create-automation page content (E25-S2). Thin client composition root rendered
 * by `new/page.tsx`. Owns the create mutation + redirect; the shared
 * `AutomationForm` owns the fields/validation/preview.
 */

import { useRouter } from "next/navigation";
import { AutomationForm, buildDefaultValues } from "./automation-form";
import { useCreateAutomation } from "../hooks/use-create-automation";
import type { AutomationWriteRequest } from "../types/automation.types";

export function AutomationNewContent() {
  const router = useRouter();
  const createMutation = useCreateAutomation();

  const handleSubmit = (body: AutomationWriteRequest) => {
    createMutation.mutate(body, {
      onSuccess: (result) =>
        router.push(`/communication/automations/${result.id}`),
    });
  };

  return (
    <AutomationForm
      mode="create"
      defaultValues={buildDefaultValues()}
      onSubmit={handleSubmit}
      pending={createMutation.isPending}
      errorMessage={createMutation.error?.message ?? null}
    />
  );
}

"use client";

// Thin route entry (E25-S2). Resolves the `id` from `use(params)` (kept here so
// the slice content component stays param-shape-agnostic) and renders the
// detail slice content; all detail logic lives in the feature slice.
import { use } from "react";
import { AutomationDetail } from "@/features/communication/automations/components/automation-detail";

export default function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AutomationDetail id={id} />;
}

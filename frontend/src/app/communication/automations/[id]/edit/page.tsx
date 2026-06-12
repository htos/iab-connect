"use client";

// Thin route entry (E25-S2). Resolves the `id` from `use(params)` and renders the
// edit slice content; the load + form logic lives in the feature slice.
import { use } from "react";
import { AutomationEditContent } from "@/features/communication/automations/components/automation-edit-content";

export default function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AutomationEditContent id={id} />;
}

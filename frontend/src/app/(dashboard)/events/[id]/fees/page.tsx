/**
 * REQ-022 (E4-S1): Event fee-category management page.
 * Thin route entry — resolves the async `params` and delegates to the Events
 * feature slice (E24-S3).
 */
"use client";

import { use } from "react";
import { EventFeesContent } from "@/features/events/components/fees/event-fees-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EventFeesPage({ params }: PageProps) {
  const { id } = use(params);
  return <EventFeesContent id={id} />;
}

/**
 * REQ-019: Edit Event Page
 * Thin route entry — resolves the async `params` and delegates to the Events
 * feature slice (E24-S2).
 */
"use client";

import { use } from "react";
import { EventEditContent } from "@/features/events/components/event-edit-content";

interface EditEventPageProps {
  params: Promise<{ id: string }>;
}

export default function EditEventPage({ params }: EditEventPageProps) {
  const { id } = use(params);
  return <EventEditContent id={id} />;
}

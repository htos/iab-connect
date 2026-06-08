/**
 * REQ-021: Event Registrations Management Page — thin route entry (E24-S3).
 * The ~779-line god-page was extracted into the events slice
 * (`EventRegistrationsContent`). This wrapper only resolves the route params and
 * renders the slice composition root.
 */
"use client";

import { use } from "react";
import { EventRegistrationsContent } from "@/features/events/components/registrations/event-registrations-content";

interface RegistrationsPageProps {
  params: Promise<{ id: string }>;
}

export default function RegistrationsPage({ params }: RegistrationsPageProps) {
  const { id } = use(params);
  return <EventRegistrationsContent id={id} />;
}

/**
 * REQ-024 (E3.S4): Volunteer-management route entry. Thin shell (E24-S3) — the
 * volunteer-management UI lives in the events feature slice
 * (`EventVolunteersContent`). Keeps `params: Promise<{ id }>` and unwraps it
 * with `use()` before delegating, preserving the route contract.
 */
"use client";

import { use } from "react";
import { EventVolunteersContent } from "@/features/events/components/volunteers/event-volunteers-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function VolunteersPage({ params }: PageProps) {
  const { id } = use(params);
  return <EventVolunteersContent id={id} />;
}

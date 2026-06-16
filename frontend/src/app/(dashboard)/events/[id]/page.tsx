/**
 * REQ-019: Event Detail Page route entry (E24-S2).
 *
 * Thin server-route shell: the ~996-line god-page was extracted into the events
 * feature slice (`src/features/events/components/event-detail.tsx`). This entry
 * keeps the `params: Promise<{ id: string }>` route contract, resolves the id,
 * and forwards it to the slice composition root.
 */
import { use } from "react";
import { EventDetail } from "@/features/events/components/event-detail";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default function EventPage({ params }: EventPageProps) {
  const { id } = use(params);
  return <EventDetail id={id} />;
}

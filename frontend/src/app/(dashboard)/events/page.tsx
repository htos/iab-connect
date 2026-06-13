// REQ-019: Events Page — thin route entry (E24-S2). All UI/data logic lives in
// the feature slice's `EventsPageContent` (the single "use client" boundary).
import { EventsPageContent } from "@/features/events/components/events-page-content";

export default function EventsPage() {
  return <EventsPageContent />;
}

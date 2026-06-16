/**
 * REQ-019: Create Event Page
 * Thin route entry — delegates to the Events feature slice (E24-S2).
 */
import { EventNewContent } from "@/features/events/components/event-new-content";

export default function NewEventPage() {
  return <EventNewContent />;
}

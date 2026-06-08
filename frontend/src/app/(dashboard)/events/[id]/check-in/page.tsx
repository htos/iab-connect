/**
 * REQ-023 (E3.S2): Event check-in page route entry (E24-S3).
 *
 * Thin route shell: the ~401-line god-page was extracted into the events feature
 * slice (`src/features/events/components/check-in/check-in-page-content.tsx`).
 * This entry keeps the `params: Promise<{ id: string }>` route contract (so the
 * E24-S1 test's `params` + `use` shim stays green), resolves the id, and
 * forwards it to the slice composition root.
 */
import { use } from "react";
import { CheckInPageContent } from "@/features/events/components/check-in/check-in-page-content";

interface CheckInPageProps {
  params: Promise<{ id: string }>;
}

export default function CheckInPage({ params }: CheckInPageProps) {
  const { id } = use(params);
  return <CheckInPageContent id={id} />;
}

// SPDX-License-Identifier: AGPL-3.0-or-later
import EventDetail from "@/features/public/components/event-detail";

/**
 * E28-S2: thin route entry for the public event detail. Awaits the route `params`
 * (Next 16 — `params` is a Promise) and delegates to the slice's async Server
 * Component, which fetches the event + fee categories at request time and mounts
 * the registration client island. Returning the content fn's promise flattens so
 * the page resolves to fully-rendered JSX. DEC-4=A.
 */
export default async function PublicEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return EventDetail({ id });
}

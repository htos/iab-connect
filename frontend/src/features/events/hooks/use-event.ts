"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys, getEvent } from "../api/events-api";

/**
 * Sentinel error so the detail component can render the dedicated
 * `events.errors.notFound` message for a 404 (vs a generic error), preserving
 * the god-page's two-branch error UI. Mirrors `SupplierNotFoundError`.
 */
export class EventNotFoundError extends Error {
  constructor() {
    super("events.errors.notFound");
    this.name = "EventNotFoundError";
  }
}

/**
 * Detail server state (E24-S2). `enabled` mirrors the page's auth gate so no GET
 * fires before authentication. A 404 throws `EventNotFoundError`.
 */
export function useEvent(id: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: eventsKeys.detail(id),
    queryFn: async () => {
      const result = await getEvent(api, id);
      if (result.status === 404) throw new EventNotFoundError();
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: enabled && !!id,
  });
}

// SPDX-License-Identifier: AGPL-3.0-or-later
import { getTranslations } from "next-intl/server";
import { getPublicEvents } from "../api/public-content-api";
import { EventsFilter } from "./events-filter";
import type { PublicEventDto } from "../types/public.types";

/**
 * E28-S2: public events LIST as an async Server Component (DEC-4=A). Fetches events
 * at request time and server-renders the hero; the search + category filter + the
 * content area (error / empty / grid) live in the `<EventsFilter>` client island.
 * The error string (the god-page surfaced `err.message` raw) is threaded into the
 * island. A79 delta: no client loading spinner (RSC awaits the fetch).
 */
export default async function EventsList() {
  const t = await getTranslations("publicEvents");

  let events: PublicEventDto[] = [];
  let error: string | null = null;
  try {
    events = await getPublicEvents();
  } catch (err) {
    error = err instanceof Error ? err.message : t("fetchError");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* Hero */}
      <section className="bg-linear-to-r from-[#EA580C] to-orange-500 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">{t("heroTitle")}</h1>
          <p className="mt-3 text-lg text-orange-100">{t("heroSubtitle")}</p>
        </div>
      </section>

      <EventsFilter events={events} error={error} />
    </div>
  );
}

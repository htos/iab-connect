"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useCreateEvent } from "../hooks/use-create-event";
import { EventForm } from "./event-form";
import { EventCategory, EventVisibility } from "../types/events.types";
import type { EventFormValues } from "../schemas/event.schema";
import type { CreateEventRequest } from "../types/events.types";

/**
 * New-event composition root (E24-S2) — the only `"use client"` boundary for
 * `/events/new`. Behaviour-preserving (A79): the manager-only gate, the
 * create→redirect-to-detail flow, and the API-error banner survive; the manual
 * `useState` form + raw `fetch` are replaced by the shared RHF+Zod `EventForm`
 * and the `useCreateEvent()` TanStack mutation (DEC-1 `useApiClient`).
 *
 * Default form values match the god-page's initial `formData`.
 */
const EMPTY_VALUES: EventFormValues = {
  title: "",
  description: "",
  location: "",
  startDate: "",
  endDate: "",
  shortDescription: "",
  locationAddress: "",
  locationUrl: "",
  isAllDay: false,
  timeZone: "Europe/Zurich",
  maxParticipants: undefined,
  registrationRequired: false,
  registrationDeadline: "",
  waitlistEnabled: false,
  visibility: EventVisibility.MembersOnly,
  category: EventCategory.General,
  tags: [],
  imageUrl: "",
  imageAltText: "",
  organizerName: "",
  contactEmail: "",
  contactPhone: "",
  cost: undefined,
  costDescription: "",
  contentLanguage: "",
};

export function EventNewContent() {
  const t = useTranslations("events");
  const router = useRouter();
  const { isVorstand, isAdmin } = useAuth();
  const createMutation = useCreateEvent();

  // Manager-only gate (god-page parity): render the forbidden alert WITHOUT
  // mounting the form, so no POST is possible.
  if (!isVorstand && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t("errors.noPermission")}
            </h2>
            <p className="mt-2 text-gray-500">
              {t("errors.noPermissionCreate")}
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              {t("actions.backToEvents")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = (payload: CreateEventRequest) => {
    createMutation.mutate(payload, {
      onSuccess: (data) => {
        if (data) router.push(`/events/${data.id}`);
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/events"
            className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t("actions.backToEvents")}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("createEvent")}
          </h1>
          <p className="mt-2 text-gray-500">{t("form.createDescription")}</p>
        </div>

        <EventForm
          defaultValues={EMPTY_VALUES}
          defaultTagsInput=""
          onSubmit={handleSubmit}
          submitLabel="actions.create"
          pendingLabel="actions.creating"
          pending={createMutation.isPending}
          errorMessage={createMutation.error?.message ?? null}
          cancelHref="/events"
        />
      </div>
    </div>
  );
}

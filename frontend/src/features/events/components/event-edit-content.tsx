"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useEvent, EventNotFoundError } from "../hooks/use-event";
import { useUpdateEvent } from "../hooks/use-update-event";
import { EventForm } from "./event-form";
import type { EventFormValues } from "../schemas/event.schema";
import type { CreateEventRequest, EventDto } from "../types/events.types";

interface EventEditContentProps {
  id: string;
}

// God-page date→input formatter: all-day uses `YYYY-MM-DD`, timed uses
// `YYYY-MM-DDTHH:mm` (the `datetime-local` value shape).
function formatDateForInput(dateString: string, isAllDay: boolean): string {
  const date = new Date(dateString);
  if (isAllDay) {
    return date.toISOString().split("T")[0];
  }
  return date.toISOString().slice(0, 16);
}

function toFormValues(event: EventDto): EventFormValues {
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    startDate: formatDateForInput(event.startDate, event.isAllDay),
    endDate: formatDateForInput(event.endDate, event.isAllDay),
    shortDescription: event.shortDescription || "",
    locationAddress: event.locationAddress || "",
    locationUrl: event.locationUrl || "",
    isAllDay: event.isAllDay,
    timeZone: event.timeZone,
    maxParticipants: event.maxParticipants,
    registrationRequired: event.registrationRequired,
    registrationDeadline: event.registrationDeadline
      ? formatDateForInput(event.registrationDeadline, false)
      : "",
    waitlistEnabled: event.waitlistEnabled,
    visibility: event.visibility,
    category: event.category,
    tags: event.tags || [],
    imageUrl: event.imageUrl || "",
    imageAltText: event.imageAltText || "",
    organizerName: event.organizerName || "",
    contactEmail: event.contactEmail || "",
    contactPhone: event.contactPhone || "",
    cost: event.cost,
    costDescription: event.costDescription || "",
    contentLanguage: event.contentLanguage || "",
  };
}

/**
 * Edit-event composition root (E24-S2) — the only `"use client"` boundary for
 * `/events/[id]/edit`. Behaviour-preserving (A79): the load skeleton, the
 * full-page notFound/loadFailed error views, the manager-only gate, and the
 * update→redirect-to-detail flow all survive; the manual `useState`+`useEffect`
 * GET and raw `fetch` PUT are replaced by `useEvent()`/`useUpdateEvent()`.
 *
 * Gate ORDER mirrors the god-page exactly: load → error-view → permission →
 * form. The GET is gated on auth (manager check happens AFTER load, like the
 * god-page which fetched first then checked roles), so a non-manager still
 * triggers the load then sees the forbidden alert.
 */
export function EventEditContent({ id }: EventEditContentProps) {
  const t = useTranslations("events");
  const router = useRouter();
  const { accessToken, isVorstand, isAdmin } = useAuth();
  const isManager = isVorstand || isAdmin;

  const {
    data: event,
    isLoading,
    error: queryError,
  } = useEvent(id, !!accessToken);
  const updateMutation = useUpdateEvent(id);

  // 1) Loading skeleton (god-page parity).
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded bg-gray-200" />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-64 rounded-xl bg-gray-200" />
              <div className="h-64 rounded-xl bg-gray-200" />
              <div className="h-64 rounded-xl bg-gray-200" />
              <div className="h-64 rounded-xl bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2) Full-page error view (notFound for 404, loadFailed otherwise) — god-page
  //    rendered this when the load failed and no event was loaded.
  if (queryError) {
    const message =
      queryError instanceof EventNotFoundError
        ? t("errors.notFound")
        : t("errors.loadFailed");
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
            <h2 className="text-xl font-semibold text-gray-900">{message}</h2>
            <Link
              href="/events"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
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
          </div>
        </div>
      </div>
    );
  }

  // 3) Permission check (AFTER load — god-page ordering).
  if (!isManager) {
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
            <p className="mt-2 text-gray-500">{t("errors.noPermissionEdit")}</p>
            <Link
              href={`/events/${id}`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              {t("actions.backToEvent")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4) Manager + loaded → prefilled form. (event is defined past the gates.)
  const defaultValues = event ? toFormValues(event) : null;
  const defaultTagsInput = (event?.tags || []).join(", ");

  const handleSubmit = (payload: CreateEventRequest) => {
    updateMutation.mutate(payload, {
      onSuccess: () => router.push(`/events/${id}`),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/events/${id}`}
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
            {t("actions.backToEvent")}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{t("editEvent")}</h1>
          <p className="mt-2 text-gray-500">{t("form.editDescription")}</p>
        </div>

        {defaultValues && (
          <EventForm
            defaultValues={defaultValues}
            defaultTagsInput={defaultTagsInput}
            onSubmit={handleSubmit}
            submitLabel="actions.save"
            pendingLabel="actions.saving"
            pending={updateMutation.isPending}
            errorMessage={updateMutation.error?.message ?? null}
            cancelHref={`/events/${id}`}
          />
        )}
      </div>
    </div>
  );
}

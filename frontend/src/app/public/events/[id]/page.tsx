"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

interface PublicEventDto {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  location: string;
  locationAddress?: string;
  locationUrl?: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  maxParticipants?: number;
  registrationRequired: boolean;
  registrationDeadline?: string;
  waitlistEnabled: boolean;
  visibility: string;
  status: string;
  category: string;
  tags: string[];
  imageUrl?: string;
  imageAltText?: string;
  organizerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  cost?: number;
  costDescription?: string;
  isFree: boolean;
  hasStarted: boolean;
  hasEnded: boolean;
  isRegistrationOpen: boolean;
}

interface RegistrationForm {
  participantName: string;
  participantEmail: string;
  participantPhone: string;
  numberOfGuests: number;
  specialRequirements: string;
}

export default function PublicEventDetailPage() {
  const t = useTranslations("publicEvents");
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<PublicEventDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<RegistrationForm>({
    participantName: "",
    participantEmail: "",
    participantPhone: "",
    numberOfGuests: 1,
    specialRequirements: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchEvent = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${baseUrl}/api/v1/events/public/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: PublicEventDto = await res.json();
        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("fetchError"));
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id, t]);

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "numberOfGuests" ? Math.max(1, parseInt(value) || 1) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch(
        `${baseUrl}/api/v1/events/${id}/registrations/public`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      setSubmitSuccess(true);
      setForm({
        participantName: "",
        participantEmail: "",
        participantPhone: "",
        numberOfGuests: 1,
        specialRequirements: "",
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : t("registrationError"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50">
        <svg
          className="h-10 w-10 animate-spin text-[#EA580C]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-medium text-red-700">{t("errorTitle")}</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <Link
            href="/public/events"
            className="mt-4 inline-block text-sm font-medium text-[#EA580C] hover:underline"
          >
            &larr; {t("backToEvents")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/public/events"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-[#EA580C] hover:underline"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          {t("backToEvents")}
        </Link>

        {/* Main card */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {/* Image / Hero */}
          <div className="relative h-64 bg-linear-to-br from-[#EA580C] to-orange-400 sm:h-72">
            {event.imageUrl ? (
              <Image
                src={event.imageUrl}
                alt={event.imageAltText ?? event.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <svg
                  className="h-20 w-20 text-white/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8">
            {/* Badges */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {event.category && (
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
                  {event.category}
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  event.isFree
                    ? "bg-green-100 text-green-800"
                    : "bg-orange-100 text-orange-800"
                }`}
              >
                {event.isFree
                  ? t("free")
                  : event.cost
                    ? `CHF ${event.cost}`
                    : t("paid")}
              </span>
              {event.hasEnded && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                  {t("eventEnded")}
                </span>
              )}
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {event.title}
            </h1>

            {/* Event ended notice */}
            {event.hasEnded && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-gray-600">
                {t("eventEndedNotice")}
              </div>
            )}

            {/* Details grid */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {/* Date & Time */}
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#EA580C]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("dateTime")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatDateTime(event.startDate)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t("until")} {formatDateTime(event.endDate)}
                  </p>
                  {event.isAllDay && (
                    <p className="text-xs text-gray-400">{t("allDay")}</p>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#EA580C]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("location")}
                  </p>
                  <p className="text-sm text-gray-600">{event.location}</p>
                  {event.locationAddress && (
                    <p className="text-sm text-gray-500">
                      {event.locationAddress}
                    </p>
                  )}
                  {event.locationUrl && (
                    <a
                      href={event.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#EA580C] hover:underline"
                    >
                      {t("viewMap")}
                    </a>
                  )}
                </div>
              </div>

              {/* Cost */}
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#EA580C]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("costLabel")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {event.isFree
                      ? t("free")
                      : event.cost
                        ? `CHF ${event.cost}`
                        : t("paid")}
                  </p>
                  {event.costDescription && (
                    <p className="text-sm text-gray-500">
                      {event.costDescription}
                    </p>
                  )}
                </div>
              </div>

              {/* Organizer / Contact */}
              {(event.organizerName || event.contactEmail) && (
                <div className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#EA580C]"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {t("organizer")}
                    </p>
                    {event.organizerName && (
                      <p className="text-sm text-gray-600">
                        {event.organizerName}
                      </p>
                    )}
                    {event.contactEmail && (
                      <a
                        href={`mailto:${event.contactEmail}`}
                        className="text-sm text-[#EA580C] hover:underline"
                      >
                        {event.contactEmail}
                      </a>
                    )}
                    {event.contactPhone && (
                      <p className="text-sm text-gray-500">
                        {event.contactPhone}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("description")}
              </h2>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {event.description}
              </div>
            </div>

            {/* Registration section */}
            {event.registrationRequired && !event.hasEnded && (
              <div className="mt-8 border-t pt-8">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("registration")}
                </h2>

                {!event.isRegistrationOpen ? (
                  <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-yellow-800">
                    {t("registrationClosed")}
                  </div>
                ) : submitSuccess ? (
                  <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-6 text-center">
                    <svg
                      className="mx-auto h-10 w-10 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="mt-3 font-medium text-green-800">
                      {t("registrationSuccess")}
                    </p>
                    <p className="mt-1 text-sm text-green-700">
                      {t("registrationSuccessDetail")}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    {submitError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {submitError}
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="participantName"
                          className="block text-sm font-medium text-gray-700"
                        >
                          {t("formName")} *
                        </label>
                        <input
                          type="text"
                          id="participantName"
                          name="participantName"
                          required
                          value={form.participantName}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="participantEmail"
                          className="block text-sm font-medium text-gray-700"
                        >
                          {t("formEmail")} *
                        </label>
                        <input
                          type="email"
                          id="participantEmail"
                          name="participantEmail"
                          required
                          value={form.participantEmail}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="participantPhone"
                          className="block text-sm font-medium text-gray-700"
                        >
                          {t("formPhone")}
                        </label>
                        <input
                          type="tel"
                          id="participantPhone"
                          name="participantPhone"
                          value={form.participantPhone}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="numberOfGuests"
                          className="block text-sm font-medium text-gray-700"
                        >
                          {t("formGuests")}
                        </label>
                        <input
                          type="number"
                          id="numberOfGuests"
                          name="numberOfGuests"
                          min={1}
                          value={form.numberOfGuests}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="specialRequirements"
                        className="block text-sm font-medium text-gray-700"
                      >
                        {t("formRequirements")}
                      </label>
                      <textarea
                        id="specialRequirements"
                        name="specialRequirements"
                        rows={3}
                        value={form.specialRequirements}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center rounded-lg bg-[#EA580C] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <svg
                            className="mr-2 h-4 w-4 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          {t("submitting")}
                        </>
                      ) : (
                        t("register")
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Registration deadline */}
            {event.registrationDeadline && !event.hasEnded && (
              <p className="mt-4 text-xs text-gray-400">
                {t("registrationDeadline")}:{" "}
                {new Date(event.registrationDeadline).toLocaleDateString(
                  "de-CH",
                  {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  },
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

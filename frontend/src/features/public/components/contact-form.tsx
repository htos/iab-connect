"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  publicContactSchema,
  type PublicContactValues,
} from "../schemas/public-contact.schema";

type FormStatus = "idle" | "loading" | "error";

interface ContactFormProps {
  // Caller-owned transport (A102/A103): receives the validated values (incl. the
  // honeypot `website`); the caller does the honeypot short-circuit + submitContact.
  onSubmit: (values: PublicContactValues) => void;
  status: FormStatus;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500";

/**
 * E28-S3: the public contact RHF+Zod form island (E22 sub-recipe; DEC-2=A keep
 * client). `noValidate` + per-field Zod errors (A96). The honeypot `website` is a
 * registered field (DEC-3); the caller's `onSubmit` reads its raw value first. The
 * submit-label swap (`sending`/`retry`/`submit`) and the error banner are driven by
 * the caller's `status`. The 6 `subject` options are byte-identical (A95).
 */
export function ContactForm({ onSubmit, status }: ContactFormProps) {
  const t = useTranslations("publicContact");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PublicContactValues>({
    resolver: zodResolver(publicContactSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
      website: "",
    },
  });

  const subjectOptions = [
    { value: "", label: t("subjectPlaceholder") },
    { value: "general", label: t("subjectGeneral") },
    { value: "membership", label: t("subjectMembership") },
    { value: "events", label: t("subjectEvents") },
    { value: "sponsoring", label: t("subjectSponsoring") },
    { value: "other", label: t("subjectOther") },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* Honeypot — hidden from real users */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          type="text"
          id="website"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>

      <div>
        <label
          htmlFor="name"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {t("nameLabel")} *
        </label>
        <input
          type="text"
          id="name"
          placeholder={t("namePlaceholder")}
          className={inputClass}
          {...register("name")}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">
            {t(errors.name.message ?? "form.required")}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {t("emailLabel")} *
        </label>
        <input
          type="email"
          id="email"
          placeholder={t("emailPlaceholder")}
          className={inputClass}
          {...register("email")}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">
            {t(errors.email.message ?? "form.required")}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="subject"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {t("subjectLabel")} *
        </label>
        <select id="subject" className={inputClass} {...register("subject")}>
          {subjectOptions.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.value === ""}
            >
              {opt.label}
            </option>
          ))}
        </select>
        {errors.subject && (
          <p className="mt-1 text-sm text-red-600">
            {t(errors.subject.message ?? "form.required")}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="message"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {t("messageLabel")} *
        </label>
        <textarea
          id="message"
          rows={6}
          placeholder={t("messagePlaceholder")}
          className={inputClass}
          {...register("message")}
        />
        {errors.message && (
          <p className="mt-1 text-sm text-red-600">
            {t(errors.message.message ?? "form.required")}
          </p>
        )}
      </div>

      {status === "error" && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {t("errorMessage")}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" && (
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
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
        )}
        {status === "loading"
          ? t("sending")
          : status === "error"
            ? t("retry")
            : t("submit")}
      </button>
    </form>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  createUserFormSchema,
  editUserFormSchema,
  type CreateUserFormValues,
  type EditUserFormValues,
} from "../schemas/admin-user.schema";
import type { Role } from "../types/admin-user.types";

/**
 * Shared new/edit admin-user form — the E22 RHF+Zod sub-recipe applied to
 * admin-users (E27-S2). ONE component drives both modes; the mode-divergent
 * surfaces are threaded through props (A98), pinned in both directions by the
 * S1 new + edit nets:
 *   - `mode`: "create" renders the invitation/temporary-password block; "edit"
 *     renders the `emailVerified` checkbox + the id/createdAt metadata.
 *   - `submitLabel`: create = "createUser", edit = (common) "save".
 *   - The redirect-vs-banner difference lives in the CONTENT, not here (this
 *     form just calls `onSubmit(values)`).
 *
 * Field bytes are preserved VERBATIM (A96 — no `.trim()`; raw values submitted).
 * `<form noValidate>` + per-field Zod errors render the `users.*` messages
 * (`emailRequired`, `passwordOrInvitationRequired`) the god-page produced — so
 * the S1 "blocks submit + shows the message + transport NOT called" assertions
 * hold with the gate moved into the resolver.
 *
 * Two prop shapes (create vs edit) discriminated by `mode` keep the value type
 * exact in each mode without a single `any`.
 */
type CreateProps = {
  mode: "create";
  defaultValues: CreateUserFormValues;
  availableRoles: Role[];
  onSubmit: (values: CreateUserFormValues) => void;
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
};

type EditProps = {
  mode: "edit";
  defaultValues: EditUserFormValues;
  availableRoles: Role[];
  onSubmit: (values: EditUserFormValues) => void;
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
  // Edit-only metadata block.
  userId: string;
  createdAt: string | null;
};

export type AdminUserFormProps = CreateProps | EditProps;

const inputClass =
  "mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500";

export function AdminUserForm(props: AdminUserFormProps) {
  if (props.mode === "create") {
    return <CreateForm {...props} />;
  }
  return <EditForm {...props} />;
}

function FieldError({ message }: { message?: string }) {
  const t = useTranslations("users");
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{t(message)}</p>;
}

function RoleCheckboxes({
  availableRoles,
  selected,
  onToggle,
}: {
  availableRoles: Role[];
  selected: string[];
  onToggle: (roleName: string) => void;
}) {
  return (
    <div className="space-y-2">
      {availableRoles.map((role) => (
        <label key={role.name} className="flex items-center">
          <input
            type="checkbox"
            checked={selected.includes(role.name)}
            onChange={() => onToggle(role.name)}
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          <span className="ml-2 text-sm text-gray-700">
            {role.name}
            {role.description && (
              <span className="ml-1 text-gray-500">({role.description})</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

function CancelSubmit({
  onCancel,
  pending,
  submitLabel,
  topBorder,
}: {
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
  topBorder: boolean;
}) {
  const tCommon = useTranslations("common");
  return (
    <div
      className={`flex justify-end gap-4 pt-4 ${
        topBorder ? "border-t border-gray-200" : ""
      }`}
    >
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
      >
        {tCommon("cancel")}
      </button>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        {submitLabel}
      </button>
    </div>
  );
}

function CreateForm({
  defaultValues,
  availableRoles,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
}: CreateProps) {
  const t = useTranslations("users");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues,
  });

  const sendInvitation = watch("sendInvitation");
  const roles = watch("roles");

  const toggleRole = (roleName: string) => {
    const current = getValues("roles");
    setValue(
      "roles",
      current.includes(roleName)
        ? current.filter((r) => r !== roleName)
        : [...current, roleName],
      { shouldValidate: false }
    );
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-6 rounded-xl bg-white p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          {t("email")} *
        </label>
        <input
          type="email"
          id="email"
          placeholder="user@example.com"
          className={inputClass}
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div>
        <label
          htmlFor="firstName"
          className="block text-sm font-medium text-gray-700"
        >
          {t("firstName")}
        </label>
        <input
          type="text"
          id="firstName"
          className={inputClass}
          {...register("firstName")}
        />
      </div>

      <div>
        <label
          htmlFor="lastName"
          className="block text-sm font-medium text-gray-700"
        >
          {t("lastName")}
        </label>
        <input
          type="text"
          id="lastName"
          className={inputClass}
          {...register("lastName")}
        />
      </div>

      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("enabled")}
          />
          <span className="ml-2 text-sm text-gray-700">{t("userEnabled")}</span>
        </label>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="mb-4 text-lg font-medium text-gray-900">
          {t("accountSetup")}
        </h3>
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              {...register("sendInvitation")}
            />
            <span className="ml-2 text-sm text-gray-700">
              {t("sendInvitationEmail")}
            </span>
          </label>
          <p className="ml-6 text-sm text-gray-500">
            {t("sendInvitationDescription")}
          </p>

          {!sendInvitation && (
            <div className="ml-6">
              <label
                htmlFor="temporaryPassword"
                className="block text-sm font-medium text-gray-700"
              >
                {t("temporaryPassword")} *
              </label>
              <input
                type="password"
                id="temporaryPassword"
                className={inputClass}
                {...register("temporaryPassword")}
              />
              <FieldError message={errors.temporaryPassword?.message} />
              <p className="mt-1 text-sm text-gray-500">
                {t("temporaryPasswordDescription")}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t("roles")}
        </label>
        <RoleCheckboxes
          availableRoles={availableRoles}
          selected={roles}
          onToggle={toggleRole}
        />
      </div>

      <CancelSubmit
        onCancel={onCancel}
        pending={pending}
        submitLabel={submitLabel}
        topBorder
      />
    </form>
  );
}

function EditForm({
  defaultValues,
  availableRoles,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
  userId,
  createdAt,
}: EditProps) {
  const t = useTranslations("users");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues,
  });

  const roles = watch("roles");

  const toggleRole = (roleName: string) => {
    const current = getValues("roles");
    setValue(
      "roles",
      current.includes(roleName)
        ? current.filter((r) => r !== roleName)
        : [...current, roleName],
      { shouldValidate: false }
    );
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-6 rounded-xl bg-white p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          {t("email")} *
        </label>
        <input
          type="email"
          id="email"
          className={inputClass}
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div>
        <label
          htmlFor="firstName"
          className="block text-sm font-medium text-gray-700"
        >
          {t("firstName")}
        </label>
        <input
          type="text"
          id="firstName"
          className={inputClass}
          {...register("firstName")}
        />
      </div>

      <div>
        <label
          htmlFor="lastName"
          className="block text-sm font-medium text-gray-700"
        >
          {t("lastName")}
        </label>
        <input
          type="text"
          id="lastName"
          className={inputClass}
          {...register("lastName")}
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("enabled")}
          />
          <span className="ml-2 text-sm text-gray-700">{t("userEnabled")}</span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("emailVerified")}
          />
          <span className="ml-2 text-sm text-gray-700">
            {t("emailVerified")}
          </span>
        </label>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t("roles")}
        </label>
        <RoleCheckboxes
          availableRoles={availableRoles}
          selected={roles}
          onToggle={toggleRole}
        />
      </div>

      <div className="border-t border-gray-200 pt-4">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">{t("userId")}</dt>
            <dd className="font-mono text-xs text-gray-900">{userId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">{t("createdAt")}</dt>
            <dd className="text-gray-900">
              {createdAt
                ? new Date(createdAt).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-"}
            </dd>
          </div>
        </dl>
      </div>

      <CancelSubmit
        onCancel={onCancel}
        pending={pending}
        submitLabel={submitLabel}
        topBorder={false}
      />
    </form>
  );
}

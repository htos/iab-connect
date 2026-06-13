/**
 * REQ-024 (E3.S4): Volunteer-management sub-page, extracted into the events
 * feature slice (E24-S3). Behaviour-preserving (A79): byte-identical transport
 * via the slice volunteer api/hooks (`useApiClient` + TanStack) replacing the
 * legacy `events` calls + manual `refreshKey` reload. The visible
 * behaviour is unchanged: parallel roles+shifts load, manual role-create form,
 * the RHF+zod shift dialog (with the Zurich-localtime→UTC-ISO conversion), the
 * assignment-aware cancel `confirm()`, and the loadFailed/saveFailed surfaces.
 *
 * The shift create/edit form is a react-hook-form + zod form rendered inside a
 * Radix dialog (R4-P-S4-1 / R4-P-S4-2) — Radix handles Escape / overlay-click
 * dismissal and focus-trapping for AC-8. Backend RequireEventStaff is the
 * security boundary; the role guard here is UX-only.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  EventVolunteerRoleDto,
  EventVolunteerShiftDto,
} from "../../types/events.types";
import {
  buildShiftSchema,
  formatZurich,
  SHIFT_TEXT_MAX,
  SHIFT_TITLE_MAX,
  utcIsoToZurichLocalInput,
  zurichLocalInputToUtcIso,
  type ShiftFormValues,
} from "../../schemas/volunteer-shift.schema";
import { useVolunteerRoles } from "../../hooks/use-volunteer-roles";
import { useVolunteerShifts } from "../../hooks/use-volunteer-shifts";
import { useVolunteerMutations } from "../../hooks/use-volunteer-mutations";

type ShiftFormTarget = {
  mode: "create" | "edit";
  roleId: string;
  shiftId?: string;
  initial: ShiftFormValues;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500";

// Stable empty-array fallbacks (see usage note where the query data is read).
const EMPTY_ROLES: EventVolunteerRoleDto[] = [];
const EMPTY_SHIFTS: EventVolunteerShiftDto[] = [];

/**
 * R4-P-S4-1 / R4-P-S4-2: shift create/edit form. Rendered only while a target is
 * set — the component mounting IS the dialog being open, so Radix's
 * `onOpenChange(false)` (Escape, overlay click, the X button) maps cleanly to
 * `onClose`. react-hook-form + zod own the field state + validation.
 */
function ShiftFormDialog({
  target,
  roles,
  eventId,
  onClose,
  onSaved,
  onError,
}: {
  target: ShiftFormTarget;
  roles: EventVolunteerRoleDto[];
  eventId: string;
  onClose: () => void;
  onSaved: () => void;
  onError: () => void;
}) {
  const t = useTranslations("events.volunteers");
  const schema = useMemo(() => buildShiftSchema(t), [t]);
  const { createShift, updateShift } = useVolunteerMutations(eventId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(schema),
    defaultValues: target.initial,
  });

  const onSubmit = async (values: ShiftFormValues) => {
    const payload = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      // Post-review H-S4-3: treat the user's datetime-local input as
      // Europe/Zurich local wall-clock time and convert to UTC ISO for the API.
      startsAt: zurichLocalInputToUtcIso(values.startsAt),
      endsAt: zurichLocalInputToUtcIso(values.endsAt),
      capacity: values.capacity,
      allowWaitlist: values.allowWaitlist,
      allowSelfSignup: values.allowSelfSignup,
      notes: values.notes.trim() || null,
    };
    const res = target.shiftId
      ? await updateShift.mutateAsync({
          shiftId: target.shiftId,
          request: payload,
        })
      : await createShift.mutateAsync({ ...payload, roleId: values.roleId });
    if (res.data) {
      onSaved();
    } else {
      onError();
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {target.mode === "edit" ? t("editShift") : t("newShift")}
          </DialogTitle>
          <DialogDescription>{t("shiftDialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("role")}
              </span>
              <select
                {...register("roleId")}
                disabled={target.mode === "edit"}
                className={inputClass}
              >
                <option value="">{t("selectRole")}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {errors.roleId && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.roleId.message}
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("title")}
              </span>
              <input
                type="text"
                {...register("title")}
                className={inputClass}
                maxLength={SHIFT_TITLE_MAX}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.title.message}
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("start")}
              </span>
              <input
                type="datetime-local"
                {...register("startsAt")}
                className={inputClass}
              />
              {errors.startsAt && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.startsAt.message}
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("end")}
              </span>
              <input
                type="datetime-local"
                {...register("endsAt")}
                className={inputClass}
              />
              {errors.endsAt && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.endsAt.message}
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("capacity")}
              </span>
              <input
                type="number"
                min={1}
                {...register("capacity", { valueAsNumber: true })}
                className={inputClass}
              />
              {errors.capacity && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.capacity.message}
                </p>
              )}
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("description")}
              </span>
              <textarea
                {...register("description")}
                className={inputClass}
                rows={2}
                maxLength={SHIFT_TEXT_MAX}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.description.message}
                </p>
              )}
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("notes")}
              </span>
              <textarea
                {...register("notes")}
                className={inputClass}
                rows={2}
                maxLength={SHIFT_TEXT_MAX}
              />
              {errors.notes && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.notes.message}
                </p>
              )}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                {...register("allowWaitlist")}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700">
                {t("allowWaitlist")}
              </span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                {...register("allowSelfSignup")}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700">
                {t("allowSelfSignup")}
              </span>
            </label>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {t("save")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EventVolunteersContent({ id: eventId }: { id: string }) {
  const router = useRouter();
  const t = useTranslations("events.volunteers");
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
    roles: userRoles,
  } = useAuth();
  const isEventManager = userRoles.includes("event-manager");
  const canManage = isVorstand || isAdmin || isEventManager;

  const queriesEnabled = isAuthenticated && canManage;
  const rolesQuery = useVolunteerRoles(eventId, queriesEnabled);
  const shiftsQuery = useVolunteerShifts(eventId, queriesEnabled);
  const { createRole, cancelShift } = useVolunteerMutations(eventId);

  // Stabilize the empty-array fallback so the `roles`/`shifts` identities only
  // change when the query data does — otherwise the `?? []` literal would make
  // a fresh array every render and churn the dependent useMemo/useCallback.
  const roles = rolesQuery.data?.data ?? EMPTY_ROLES;
  const shifts = shiftsQuery.data?.data ?? EMPTY_SHIFTS;
  // Quirk preserved: the load effect bails on !canManage WITHOUT clearing
  // `loading`, so an out-of-role user stays pinned on the loading skeleton. We
  // mirror that: when the queries are disabled (gated), `loading` stays true.
  const loading = queriesEnabled
    ? rolesQuery.isPending || shiftsQuery.isPending
    : true;

  const [error, setError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [shiftFormTarget, setShiftFormTarget] =
    useState<ShiftFormTarget | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  // Auth guard.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Surface `loadFailed` when EITHER loader returns an API error (the god-page
  // set the banner if rolesRes.error || shiftsRes.error, while still rendering
  // whatever loaded). The queries return `{ data, error }` rather than throwing.
  useEffect(() => {
    if (!queriesEnabled) return;
    if (rolesQuery.data?.error || shiftsQuery.data?.error) {
      setError(t("loadFailed"));
    }
  }, [queriesEnabled, rolesQuery.data, shiftsQuery.data, t]);

  const shiftsByRoleId = useMemo(() => {
    const map = new Map<string, EventVolunteerShiftDto[]>();
    for (const role of roles) map.set(role.id, []);
    for (const shift of shifts) {
      const list = map.get(shift.roleId);
      if (list) list.push(shift);
      else map.set(shift.roleId, [shift]);
    }
    return map;
  }, [roles, shifts]);

  const handleCreateRole = useCallback(async () => {
    const name = newRoleName.trim();
    if (!name) return;
    setActionInFlight("createRole");
    try {
      const res = await createRole.mutateAsync({
        name,
        description: newRoleDescription.trim() || null,
      });
      if (res.data) {
        setNewRoleName("");
        setNewRoleDescription("");
      } else {
        setError(t("saveFailed"));
      }
    } finally {
      setActionInFlight(null);
    }
  }, [createRole, newRoleName, newRoleDescription, t]);

  const openCreateShift = useCallback((roleId: string) => {
    setShiftFormTarget({
      mode: "create",
      roleId,
      initial: {
        roleId,
        title: "",
        description: "",
        startsAt: "",
        endsAt: "",
        capacity: 1,
        allowWaitlist: false,
        allowSelfSignup: false,
        notes: "",
      },
    });
  }, []);

  const openEditShift = useCallback((shift: EventVolunteerShiftDto) => {
    setShiftFormTarget({
      mode: "edit",
      roleId: shift.roleId,
      shiftId: shift.id,
      initial: {
        roleId: shift.roleId,
        title: shift.title,
        description: shift.description ?? "",
        // Post-review H-S4-3: backend stores Kind=Utc; surface as Europe/Zurich
        // wall-clock.
        startsAt: utcIsoToZurichLocalInput(shift.startsAt),
        endsAt: utcIsoToZurichLocalInput(shift.endsAt),
        capacity: shift.capacity,
        allowWaitlist: shift.allowWaitlist,
        allowSelfSignup: shift.allowSelfSignup,
        notes: shift.notes ?? "",
      },
    });
  }, []);

  const handleCancelShift = useCallback(
    async (shiftId: string) => {
      // Post-review M-S4-7: warn the operator about how many active assignments
      // will be cancelled. We use the shift card's confirmed/waitlist counts
      // (already loaded).
      const shift = shifts.find((s) => s.id === shiftId);
      const assignmentCount =
        (shift?.confirmedCount ?? 0) + (shift?.waitlistCount ?? 0);
      const message =
        assignmentCount > 0
          ? t("confirmDeleteWithAssignments", { count: assignmentCount })
          : t("confirmDelete");
      if (!confirm(message)) return;
      setActionInFlight(shiftId);
      try {
        const res = await cancelShift.mutateAsync({ shiftId });
        if (!res.data) setError(t("saveFailed"));
      } finally {
        setActionInFlight(null);
      }
    },
    [cancelShift, shifts, t]
  );

  if (authLoading || loading) {
    return (
      <PageShell maxWidth="6xl">
        <div className="mb-6 h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-96 animate-pulse rounded-xl bg-gray-200" />
      </PageShell>
    );
  }

  if (!isAuthenticated) return null;

  if (!canManage) {
    return (
      <PageShell maxWidth="6xl">
        <div
          role="alert"
          className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800"
        >
          {t("permissionDenied")}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="6xl">
      <Link
        href={`/events/${eventId}`}
        className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-orange-600"
      >
        ← {t("backToEvent")}
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("pageTitle")}</h1>
        <p className="mt-1 text-gray-500">{t("pageDescription")}</p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-medium"
          >
            ×
          </button>
        </div>
      )}

      {/* Role create form */}
      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          {t("newRole")}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {t("roleName")}
            </span>
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className={inputClass}
              maxLength={100}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {t("roleDescription")}
            </span>
            <input
              type="text"
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
              className={inputClass}
              maxLength={500}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleCreateRole}
            disabled={!newRoleName.trim() || actionInFlight === "createRole"}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {t("save")}
          </button>
        </div>
      </section>

      {/* Shift create / edit dialog — mounted only while a target is set. The
            `key` forces a fresh react-hook-form instance (with the right
            defaults) when the target changes. */}
      {shiftFormTarget && (
        <ShiftFormDialog
          key={shiftFormTarget.shiftId ?? `new-${shiftFormTarget.roleId}`}
          target={shiftFormTarget}
          roles={roles}
          eventId={eventId}
          onClose={() => setShiftFormTarget(null)}
          onSaved={() => setShiftFormTarget(null)}
          onError={() => setError(t("saveFailed"))}
        />
      )}

      {/* Roles + shifts table */}
      {roles.length === 0 && shifts.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
          {t("noShifts")}
        </div>
      )}

      {roles.map((role) => {
        const roleShifts = shiftsByRoleId.get(role.id) ?? [];
        return (
          <section
            key={role.id}
            className="mb-4 rounded-xl bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {role.name}
                </h2>
                {role.description && (
                  <p className="text-sm text-gray-500">{role.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => openCreateShift(role.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
              >
                {t("newShift")}
              </button>
            </div>
            {roleShifts.length === 0 ? (
              <p className="text-sm text-gray-500">{t("noShifts")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2">{t("title")}</th>
                    <th className="py-2">{t("start")}</th>
                    <th className="py-2">{t("end")}</th>
                    <th className="py-2">{t("assigned")}</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {roleShifts.map((shift) => (
                    <tr key={shift.id} className="border-b last:border-0">
                      <td className="py-2">{shift.title}</td>
                      <td className="py-2">{formatZurich(shift.startsAt)}</td>
                      <td className="py-2">{formatZurich(shift.endsAt)}</td>
                      <td className="py-2">
                        {shift.confirmedCount} / {shift.capacity}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openEditShift(shift)}
                          className="mr-3 text-sm font-medium text-orange-700 hover:text-orange-800"
                        >
                          {t("editShift")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelShift(shift.id)}
                          disabled={actionInFlight === shift.id}
                          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          {t("cancelShift")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </PageShell>
  );
}

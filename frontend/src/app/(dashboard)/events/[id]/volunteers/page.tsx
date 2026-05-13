/**
 * REQ-024 (E3.S4): Volunteer-management page for event staff.
 *
 * Table view of shifts grouped by role + inline forms for role/shift create/edit.
 * Backend RequireEventStaff is the security boundary; the role guard here is UX-only.
 */
'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';
import {
  type EventVolunteerRoleDto,
  type EventVolunteerShiftDto,
  cancelVolunteerShift,
  createVolunteerRole,
  createVolunteerShift,
  getEventVolunteerRoles,
  getEventVolunteerShifts,
  updateVolunteerShift,
} from '@/lib/services/events';

/**
 * REQ-024 (E3.S4 review M-S4-6): event times come from the backend in UTC. To keep wall-clock
 * consistency between the table view, the edit form, and the reminder email, lock the display
 * to the operator's primary timezone Europe/Zurich.
 */
const ZURICH_TIME_ZONE = 'Europe/Zurich';

function formatZurich(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString('de-CH', { timeZone: ZURICH_TIME_ZONE });
}

/**
 * REQ-024 (E3.S4 review H-S4-3): convert an ISO-UTC string to the `yyyy-MM-ddTHH:mm` form
 * expected by `<input type="datetime-local">`, rendered in Europe/Zurich wall-clock time.
 * Previously the code did `iso.slice(0, 16)` which keeps the UTC value but strips the `Z`,
 * causing the browser to interpret it as local time on display and silently shift by the
 * local offset on save.
 */
function utcIsoToZurichLocalInput(isoUtc: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(isoUtc));
  const lookup = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${lookup('year')}-${lookup('month')}-${lookup('day')}T${lookup('hour')}:${lookup('minute')}`;
}

/**
 * REQ-024 (E3.S4 review H-S4-3): convert a `<input type="datetime-local">` value (which the
 * user entered in Europe/Zurich wall-clock time) into an ISO-UTC string for the API. We
 * compute the UTC offset for the chosen instant once, then subtract it so the resulting
 * Date represents the correct UTC moment. Uses `formatToParts` instead of `Date.parse` to
 * stay DST-correct on transition days.
 */
function zurichLocalInputToUtcIso(localInput: string): string {
  if (!localInput) return '';
  // Step 1: parse the user's wall-clock value as if it were UTC. This is intentionally wrong
  // — we use the result to ask the Intl API what the offset would be for that local instant.
  const asUtc = new Date(`${localInput}:00.000Z`);
  if (Number.isNaN(asUtc.getTime())) return '';
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZURICH_TIME_ZONE,
    timeZoneName: 'shortOffset',
  }).formatToParts(asUtc);
  const offsetLabel = tzParts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
  // shortOffset returns "GMT+1", "GMT+2", "GMT-3" etc. for hour-offset zones.
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offsetLabel);
  const sign = match?.[1] === '-' ? -1 : 1;
  const hours = match ? parseInt(match[2], 10) : 0;
  const minutes = match?.[3] ? parseInt(match[3], 10) : 0;
  const offsetMinutes = sign * (hours * 60 + minutes);
  // Step 2: subtract the offset to land on the correct UTC instant.
  return new Date(asUtc.getTime() - offsetMinutes * 60_000).toISOString();
}

type ShiftDraft = {
  roleId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  allowWaitlist: boolean;
  allowSelfSignup: boolean;
  notes: string;
};

const emptyShiftDraft = (roleId = ''): ShiftDraft => ({
  roleId,
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  capacity: 1,
  allowWaitlist: false,
  allowSelfSignup: false,
  notes: '',
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function VolunteersPage({ params }: PageProps) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const t = useTranslations('events.volunteers');
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, roles: userRoles } = useAuth();
  const isEventManager = userRoles.includes('event-manager');
  const canManage = isVorstand || isAdmin || isEventManager;

  const [roles, setRoles] = useState<EventVolunteerRoleDto[]>([]);
  const [shifts, setShifts] = useState<EventVolunteerShiftDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  const [shiftDraft, setShiftDraft] = useState<ShiftDraft | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  // Auth guard.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load data (refreshKey-keyed).
  useEffect(() => {
    if (!isAuthenticated || !canManage) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [rolesRes, shiftsRes] = await Promise.all([
          getEventVolunteerRoles(eventId),
          getEventVolunteerShifts(eventId),
        ]);
        if (cancelled) return;
        if (rolesRes.data) setRoles(rolesRes.data);
        if (shiftsRes.data) setShifts(shiftsRes.data);
        if (rolesRes.error || shiftsRes.error) setError(t('loadFailed'));
      } catch {
        if (!cancelled) setError(t('loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, refreshKey, canManage, isAuthenticated, t]);

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
    setActionInFlight('createRole');
    try {
      const res = await createVolunteerRole(eventId, {
        name,
        description: newRoleDescription.trim() || null,
      });
      if (res.data) {
        setNewRoleName('');
        setNewRoleDescription('');
        setRefreshKey((k) => k + 1);
      } else {
        setError(t('saveFailed'));
      }
    } finally {
      setActionInFlight(null);
    }
  }, [eventId, newRoleName, newRoleDescription, t]);

  const handleSaveShift = useCallback(async () => {
    if (!shiftDraft || !shiftDraft.roleId || !shiftDraft.title || !shiftDraft.startsAt || !shiftDraft.endsAt) {
      setError(t('saveFailed'));
      return;
    }
    setActionInFlight('saveShift');
    try {
      const payload = {
        title: shiftDraft.title.trim(),
        description: shiftDraft.description.trim() || null,
        // Post-review H-S4-3: treat the user's datetime-local input as Europe/Zurich local
        // wall-clock time and convert to UTC ISO for the API. The previous code passed the
        // raw value to `new Date(...)` which interpreted it as the browser's local time and
        // round-tripped to UTC with an offset that didn't match the operator's mental model.
        startsAt: zurichLocalInputToUtcIso(shiftDraft.startsAt),
        endsAt: zurichLocalInputToUtcIso(shiftDraft.endsAt),
        capacity: shiftDraft.capacity,
        allowWaitlist: shiftDraft.allowWaitlist,
        allowSelfSignup: shiftDraft.allowSelfSignup,
        notes: shiftDraft.notes.trim() || null,
      };
      const res = editingShiftId
        ? await updateVolunteerShift(eventId, editingShiftId, payload)
        : await createVolunteerShift(eventId, { ...payload, roleId: shiftDraft.roleId });
      if (res.data) {
        setShiftDraft(null);
        setEditingShiftId(null);
        setRefreshKey((k) => k + 1);
      } else {
        setError(t('saveFailed'));
      }
    } finally {
      setActionInFlight(null);
    }
  }, [eventId, shiftDraft, editingShiftId, t]);

  const handleCancelShift = useCallback(
    async (shiftId: string) => {
      // Post-review M-S4-7: warn the operator about how many active assignments will be
      // cancelled. We use the shift card's confirmed/waitlist counts (already loaded) — a
      // future iteration could move this to a custom modal, but the count surfaces the cost
      // of the action loudly enough to address the silent-cascade concern in the review.
      const shift = shifts.find((s) => s.id === shiftId);
      const assignmentCount = (shift?.confirmedCount ?? 0) + (shift?.waitlistCount ?? 0);
      const message = assignmentCount > 0
        ? t('confirmDeleteWithAssignments', { count: assignmentCount })
        : t('confirmDelete');
      if (!confirm(message)) return;
      setActionInFlight(shiftId);
      try {
        const res = await cancelVolunteerShift(eventId, shiftId);
        if (res.data) setRefreshKey((k) => k + 1);
        else setError(t('saveFailed'));
      } finally {
        setActionInFlight(null);
      }
    },
    [eventId, shifts, t]
  );

  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse h-8 w-64 bg-gray-200 rounded mb-6" />
          <div className="animate-pulse h-96 bg-gray-200 rounded-xl" />
        </div>
      </main>
    );
  }

  if (!isAuthenticated) return null;

  if (!canManage) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div role="alert" className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
            {t('permissionDenied')}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 mb-6 transition-colors"
        >
          ← {t('backToEvent')}
        </Link>

        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
          <p className="text-gray-500 mt-1">{t('pageDescription')}</p>
        </header>

        {error && (
          <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-medium">×</button>
          </div>
        )}

        {/* Role create form */}
        <section className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('newRole')}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">{t('roleName')}</span>
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                maxLength={100}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">{t('roleDescription')}</span>
              <input
                type="text"
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                maxLength={500}
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleCreateRole}
              disabled={!newRoleName.trim() || actionInFlight === 'createRole'}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {t('save')}
            </button>
          </div>
        </section>

        {/* Shift create / edit form (only when active) */}
        {shiftDraft && (
          <section className="bg-white rounded-xl shadow-sm p-4 mb-6 border-2 border-orange-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {editingShiftId ? t('editShift') : t('newShift')}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">{t('role')}</span>
                <select
                  value={shiftDraft.roleId}
                  onChange={(e) => setShiftDraft({ ...shiftDraft, roleId: e.target.value })}
                  disabled={editingShiftId !== null}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">{t('selectRole')}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">{t('title')}</span>
                <input
                  type="text"
                  value={shiftDraft.title}
                  onChange={(e) => setShiftDraft({ ...shiftDraft, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  maxLength={200}
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">{t('start')}</span>
                <input
                  type="datetime-local"
                  value={shiftDraft.startsAt}
                  onChange={(e) => setShiftDraft({ ...shiftDraft, startsAt: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">{t('end')}</span>
                <input
                  type="datetime-local"
                  value={shiftDraft.endsAt}
                  onChange={(e) => setShiftDraft({ ...shiftDraft, endsAt: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">{t('capacity')}</span>
                <input
                  type="number"
                  min={1}
                  value={shiftDraft.capacity}
                  onChange={(e) => {
                    // Post-review M-S4-8: parseInt returns NaN for non-numeric input (e.g.
                    // the user clears the field then types a letter). NaN propagates into
                    // JSON.stringify as `null` and the backend returns 400. Guard with
                    // Number.isFinite so the field always carries a usable integer.
                    const parsed = parseInt(e.target.value || '1', 10);
                    const safe = Number.isFinite(parsed) ? parsed : 1;
                    setShiftDraft({ ...shiftDraft, capacity: Math.max(1, safe) });
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="block text-sm font-medium text-gray-700 mb-1">{t('description')}</span>
                <textarea
                  value={shiftDraft.description}
                  onChange={(e) => setShiftDraft({ ...shiftDraft, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={2}
                  maxLength={1000}
                />
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={shiftDraft.allowWaitlist}
                  onChange={(e) => setShiftDraft({ ...shiftDraft, allowWaitlist: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">{t('allowWaitlist')}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={shiftDraft.allowSelfSignup}
                  onChange={(e) => setShiftDraft({ ...shiftDraft, allowSelfSignup: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">{t('allowSelfSignup')}</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShiftDraft(null); setEditingShiftId(null); }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveShift}
                disabled={actionInFlight === 'saveShift'}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {t('save')}
              </button>
            </div>
          </section>
        )}

        {/* Roles + shifts table */}
        {roles.length === 0 && shifts.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            {t('noShifts')}
          </div>
        )}

        {roles.map((role) => {
          const roleShifts = shiftsByRoleId.get(role.id) ?? [];
          return (
            <section key={role.id} className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{role.name}</h2>
                  {role.description && <p className="text-sm text-gray-500">{role.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setShiftDraft(emptyShiftDraft(role.id))}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
                >
                  {t('newShift')}
                </button>
              </div>
              {roleShifts.length === 0 ? (
                <p className="text-sm text-gray-500">{t('noShifts')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2">{t('title')}</th>
                      <th className="py-2">{t('start')}</th>
                      <th className="py-2">{t('end')}</th>
                      <th className="py-2">{t('assigned')}</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleShifts.map((shift) => (
                      <tr key={shift.id} className="border-b last:border-0">
                        <td className="py-2">{shift.title}</td>
                        <td className="py-2">{formatZurich(shift.startsAt)}</td>
                        <td className="py-2">{formatZurich(shift.endsAt)}</td>
                        <td className="py-2">{shift.confirmedCount} / {shift.capacity}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingShiftId(shift.id);
                              setShiftDraft({
                                roleId: shift.roleId,
                                title: shift.title,
                                description: shift.description ?? '',
                                // Post-review H-S4-3: backend stores Kind=Utc; surface as
                                // Europe/Zurich wall-clock in the datetime-local input.
                                startsAt: utcIsoToZurichLocalInput(shift.startsAt),
                                endsAt: utcIsoToZurichLocalInput(shift.endsAt),
                                capacity: shift.capacity,
                                allowWaitlist: shift.allowWaitlist,
                                allowSelfSignup: shift.allowSelfSignup,
                                notes: shift.notes ?? '',
                              });
                            }}
                            className="text-orange-700 hover:text-orange-800 text-sm font-medium mr-3"
                          >
                            {t('editShift')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelShift(shift.id)}
                            disabled={actionInFlight === shift.id}
                            className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                          >
                            {t('cancelShift')}
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
      </div>
    </main>
  );
}

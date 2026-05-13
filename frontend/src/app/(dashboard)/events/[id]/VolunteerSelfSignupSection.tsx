/**
 * REQ-024 (E3.S4): Member self-signup section for the event-detail page.
 *
 * Renders only shifts where `AllowSelfSignup == true` and the event is not cancelled.
 * On 409 from the backend, surfaces an inline error pill and bumps `refreshKey` to
 * re-fetch fresh state — no optimistic local capacity decrements.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  type EventVolunteerShiftDto,
  type VolunteerErrorCode,
  getEventVolunteerShifts,
  signUpForVolunteerShift,
  withdrawFromVolunteerShift,
} from '@/lib/services/events';

/**
 * REQ-024 (E3.S4 review M-S4-6): backend stores shift times in UTC. Lock the formatter to
 * Europe/Zurich so the member sees the same wall-clock value the staff form (and the email)
 * shows, independent of the member's browser timezone.
 */
const ZURICH_TIME_ZONE = 'Europe/Zurich';

function formatZurich(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString('de-CH', { timeZone: ZURICH_TIME_ZONE });
}

interface Props {
  eventId: string;
  eventCancelled: boolean;
}

interface FlashMessage {
  kind: 'error' | 'success';
  text: string;
}

export function VolunteerSelfSignupSection({ eventId, eventCancelled }: Props) {
  const t = useTranslations('events.volunteers');
  const [shifts, setShifts] = useState<EventVolunteerShiftDto[]>([]);
  const [loading, setLoading] = useState(true);
  // Post-review M-S4-2: distinguish "no shifts" (collapse the section) from "load failed"
  // (render an error pill). Previously a 5xx response silently set an empty array.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [signupInFlight, setSignupInFlight] = useState<string | null>(null);
  // Post-review M-S4-3: per-shift signup state so the card switches to a green
  // "Eingetragen + Austragen" pill after a successful signup, without waiting for a full
  // page refresh. Map shiftId → assignmentId because the withdraw endpoint requires the
  // assignment id, not the shift id. Tracking is local-only — a future server-side flag
  // on the DTO would let us seed this from initial load too (carried in deferred-work).
  const [signedUpByShift, setSignedUpByShift] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      const res = await getEventVolunteerShifts(eventId);
      if (cancelled) return;
      if (res.data) {
        setShifts(res.data);
      } else {
        setShifts([]);
        // Any non-200 response (5xx, 403, etc.) surfaces as a generic error so the section
        // doesn't silently disappear on a transient backend failure.
        setLoadError(t('loadFailed'));
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, refreshKey, t]);

  const selfSignupShifts = useMemo(
    () => shifts.filter((s) => s.allowSelfSignup),
    [shifts]
  );

  const handleSignUp = useCallback(
    async (shiftId: string) => {
      setSignupInFlight(shiftId);
      setFlash(null);
      try {
        const res = await signUpForVolunteerShift(eventId, shiftId);
        if (res.data) {
          setFlash({ kind: 'success', text: t('signedUp') });
          setSignedUpByShift((prev) => {
            const next = new Map(prev);
            next.set(shiftId, res.data!.id);
            return next;
          });
          setRefreshKey((k) => k + 1);
          return;
        }
        // Translate the typed error code from the 409 / 403 body.
        const errorCode = res.errorBody?.errorCode as VolunteerErrorCode | undefined;
        let msg = t('signupFailed');
        if (errorCode === 'ShiftFull') msg = t('shiftJustFilledUp');
        else if (errorCode === 'AlreadyAssigned') msg = t('alreadyAssigned');
        else if (errorCode === 'SignupNotAllowed') msg = t('signupNotAllowed');
        else if (errorCode === 'NoMemberLink') msg = t('noMemberLink');
        setFlash({ kind: 'error', text: msg });
        // Refresh to show server-side state (capacity may have changed).
        setRefreshKey((k) => k + 1);
      } finally {
        setSignupInFlight(null);
      }
    },
    [eventId, t]
  );

  const handleWithdraw = useCallback(
    async (shiftId: string, assignmentId: string) => {
      setSignupInFlight(shiftId);
      setFlash(null);
      try {
        const res = await withdrawFromVolunteerShift(eventId, shiftId, assignmentId);
        if (res.data || res.status === 204) {
          setFlash({ kind: 'success', text: t('withdrawn') });
          setSignedUpByShift((prev) => {
            const next = new Map(prev);
            next.delete(shiftId);
            return next;
          });
          setRefreshKey((k) => k + 1);
        } else {
          setFlash({ kind: 'error', text: t('withdrawFailed') });
        }
      } finally {
        setSignupInFlight(null);
      }
    },
    [eventId, t]
  );

  if (eventCancelled) return null;
  if (loading) return null;
  if (!loadError && selfSignupShifts.length === 0) return null;

  return (
    <section className="bg-white rounded-xl shadow-sm p-4 md:p-6 mt-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{t('memberSectionTitle')}</h2>
        <p className="text-sm text-gray-500">{t('memberSectionDescription')}</p>
      </header>

      {loadError && (
        <div role="alert" className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-red-800">
          {loadError}
        </div>
      )}

      {flash && (
        <div
          role={flash.kind === 'error' ? 'alert' : 'status'}
          className={`mb-3 px-3 py-2 rounded ${
            flash.kind === 'error'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          {flash.text}
        </div>
      )}

      <ul className="divide-y divide-gray-200">
        {selfSignupShifts.map((shift) => {
          const freeSpots = Math.max(0, shift.capacity - shift.confirmedCount);
          const isFull = freeSpots === 0;
          const mineAssignmentId = signedUpByShift.get(shift.id);
          return (
            <li key={shift.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{shift.roleName} · {shift.title}</div>
                <div className="text-xs text-gray-500">
                  {formatZurich(shift.startsAt)}
                  {' — '}
                  {formatZurich(shift.endsAt)}
                  {' · '}
                  {freeSpots} {t('free')}
                </div>
              </div>
              {mineAssignmentId ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-medium">
                    ✓ {t('signedUp')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleWithdraw(shift.id, mineAssignmentId)}
                    disabled={signupInFlight === shift.id}
                    className="text-red-700 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                  >
                    {t('withdraw')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSignUp(shift.id)}
                  disabled={isFull || signupInFlight === shift.id}
                  aria-disabled={isFull}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isFull
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50'
                  }`}
                >
                  {isFull ? t('full') : t('signUp')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

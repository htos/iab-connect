/**
 * REQ-023 (E3.S2): Event check-in page.
 *
 * Three UI states share the page:
 *   - Scanner: live QR scanning via @yudiel/react-qr-scanner. Auto-flips to manual on
 *     camera unavailability.
 *   - Manual: name search over the E3.S1 roster filtered client-side (D5). On row click,
 *     POST to /manual-check-in (the search term is sent for audit-hashing).
 *   - Result: shared banner that distinguishes a real check-in from an idempotent already-
 *     checked-in return per CheckInResultDto.
 *
 * Backend RequireEventStaff is the security boundary; the role guard here is UX-only.
 */
'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';
import {
  type CheckInResultDto,
  type EventCheckInRosterDto,
  type EventCheckInRosterItemDto,
  checkInByQrCode,
  getEventCheckInRoster,
  manualCheckIn,
} from '@/lib/services/events';

// Dynamic import so the camera-only library never lands in the SSR bundle.
const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((m) => m.Scanner),
  { ssr: false },
);

type Tab = 'scanner' | 'manual';
type CameraState = 'probing' | 'available' | 'unavailable';

interface CheckInPageProps {
  params: Promise<{ id: string }>;
}

export default function CheckInPage({ params }: CheckInPageProps) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const t = useTranslations('events.checkIn');
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, roles } = useAuth();
  const isEventManager = roles.includes('event-manager');
  const canAccess = isVorstand || isAdmin || isEventManager;

  const [activeTab, setActiveTab] = useState<Tab>('scanner');
  const [cameraState, setCameraState] = useState<CameraState>('probing');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roster, setRoster] = useState<EventCheckInRosterDto | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<CheckInResultDto | null>(null);
  const [invalidQrToken, setInvalidQrToken] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  // Post-review M-S2-4: surface network/server failures so the operator can re-scan instead
  // of silently looking at an unchanged screen.
  const [networkError, setNetworkError] = useState<string | null>(null);
  // Post-review M-S2-3: dedupe the same token within a short window so a still QR in the
  // scanner viewfinder doesn't trigger a check-in once per frame.
  const [lastScannedToken, setLastScannedToken] = useState<string | null>(null);

  // Auth guard.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Camera probe; auto-flip to manual on failure.
  useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraState('unavailable');
          setActiveTab('manual');
        }
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Release the probe stream immediately — the scanner component re-acquires when mounted.
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelled) setCameraState('available');
      } catch {
        if (!cancelled) {
          setCameraState('unavailable');
          setActiveTab('manual');
        }
      }
    }
    probe();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce 250ms per AC-7.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  // Roster load (refreshKey-keyed per dos-and-donts item 13).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getEventCheckInRoster(eventId, { includeWaitlisted: false });
      if (cancelled) return;
      if (res.data) {
        setRoster(res.data);
        setRosterError(null);
      } else {
        setRosterError(t('manual.loadRosterFailed'));
      }
    }
    if (canAccess) load();
    return () => {
      cancelled = true;
    };
  }, [eventId, refreshKey, canAccess, t]);

  const filteredRoster: EventCheckInRosterItemDto[] = useMemo(() => {
    if (!roster) return [];
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return roster.items;
    return roster.items.filter((r) => r.participantName.toLowerCase().includes(q));
  }, [roster, debouncedSearch]);

  // Post-review M-S2-5: a single decoder/permission glitch should NOT permanently disable
  // the scanner. Surface a transient error banner but keep the tab active; only the camera
  // probe (true unavailable) flips us to manual permanently.
  const handleScannerError = useCallback(() => {
    setNetworkError(t('scanner.transientError'));
  }, [t]);

  const handleQrDecode = useCallback(
    async (rawValue: string) => {
      if (!rawValue || actionInFlight === 'qr') return;
      // Post-review M-S2-3: dedupe the same token within the same scanner session. The user
      // explicitly resets by clicking "scan again" on the invalid-QR banner or by closing the
      // result banner (which clears lastScannedToken).
      if (rawValue === lastScannedToken) return;
      setLastScannedToken(rawValue);
      setActionInFlight('qr');
      setInvalidQrToken(null);
      setNetworkError(null);
      try {
        const res = await checkInByQrCode(rawValue);
        if (res.data && res.data.outcome !== 'NotFound') {
          setResult(res.data);
          setRefreshKey((k) => k + 1);
        } else if (res.error || res.status === 0 || (res.status ?? 0) >= 500) {
          // Post-review M-S2-4: 5xx / network failures previously fell through silently.
          setNetworkError(t('scanner.networkError'));
        } else {
          setResult(null);
          setInvalidQrToken(rawValue.slice(0, 8));
        }
      } catch {
        setNetworkError(t('scanner.networkError'));
      } finally {
        setActionInFlight(null);
      }
    },
    [actionInFlight, lastScannedToken, t],
  );

  const handleManualCheckIn = useCallback(
    async (registrationId: string) => {
      setActionInFlight(registrationId);
      setNetworkError(null);
      try {
        const res = await manualCheckIn(eventId, registrationId, debouncedSearch || undefined);
        if (res.data) {
          setResult(res.data);
          setRefreshKey((k) => k + 1);
        } else {
          // Post-review M-S2-4: same network-error guarding as QR.
          setNetworkError(t('manual.checkInFailed'));
        }
      } catch {
        setNetworkError(t('manual.checkInFailed'));
      } finally {
        setActionInFlight(null);
      }
    },
    [eventId, debouncedSearch, t],
  );

  if (authLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse h-8 w-48 bg-gray-200 rounded mb-6" />
          <div className="animate-pulse h-96 bg-gray-200 rounded-xl" />
        </div>
      </main>
    );
  }

  if (!isAuthenticated) return null;

  if (!canAccess) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div role="alert" className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
            {t('forbidden')}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 mb-6 transition-colors"
        >
          ← {t('title')}
        </Link>

        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 mt-1">{t('subtitle')}</p>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            disabled={cameraState === 'unavailable'}
            aria-pressed={activeTab === 'scanner'}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors disabled:opacity-50 ${
              activeTab === 'scanner'
                ? 'border-orange-600 text-orange-700'
                : 'border-transparent text-gray-600 hover:text-orange-600'
            }`}
          >
            {t('tabs.scanner')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            aria-pressed={activeTab === 'manual'}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'manual'
                ? 'border-orange-600 text-orange-700'
                : 'border-transparent text-gray-600 hover:text-orange-600'
            }`}
          >
            {t('tabs.manual')}
          </button>
        </div>

        {/* Result card */}
        {result?.registration && (
          <div
            role="status"
            className={`mb-4 px-4 py-3 rounded-lg border ${
              result.outcome === 'CheckedIn'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : result.outcome === 'AlreadyCheckedIn'
                  ? 'bg-orange-50 border-orange-200 text-orange-800'
                  : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {result.outcome === 'CheckedIn' && t('result.checkedIn', { name: result.registration.participantName })}
            {result.outcome === 'AlreadyCheckedIn' &&
              t('result.alreadyCheckedIn', {
                name: result.registration.participantName,
                time: result.registration.checkedInAt
                  ? new Date(result.registration.checkedInAt).toLocaleTimeString('de-CH')
                  : '?',
              })}
            {result.outcome === 'Conflict' && result.conflict === 'Cancelled' && t('result.cancelledConflict')}
            {result.outcome === 'Conflict' && result.conflict === 'Waitlisted' && t('result.waitlistedConflict')}
          </div>
        )}

        {/* Post-review M-S2-4 / M-S2-5: transient network or scanner error banner */}
        {networkError && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-lg border bg-amber-50 border-amber-200 text-amber-900 flex items-center justify-between">
            <span>{networkError}</span>
            <button
              type="button"
              onClick={() => { setNetworkError(null); setLastScannedToken(null); }}
              className="text-sm font-medium text-orange-700 hover:text-orange-800"
            >
              {t('scanner.scanAgain')}
            </button>
          </div>
        )}

        {/* Invalid QR banner */}
        {invalidQrToken && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-lg border bg-red-50 border-red-200 text-red-800 flex items-center justify-between">
            <span>{t('scanner.invalidQr', { token: invalidQrToken })}</span>
            <button
              type="button"
              onClick={() => { setInvalidQrToken(null); setLastScannedToken(null); }}
              className="text-sm font-medium text-orange-700 hover:text-orange-800"
            >
              {t('scanner.scanAgain')}
            </button>
          </div>
        )}

        {/* Scanner state */}
        {activeTab === 'scanner' && (
          <section aria-label={t('tabs.scanner')} className="bg-white rounded-xl shadow-sm p-4">
            {cameraState === 'available' && (
              <>
                <p className="text-sm text-gray-600 mb-3">{t('scanner.ready')}</p>
                <div className="max-w-md mx-auto">
                  <QrScanner
                    onScan={(detected: { rawValue: string }[]) => {
                      if (detected[0]?.rawValue) handleQrDecode(detected[0].rawValue);
                    }}
                    onError={handleScannerError}
                    constraints={{ facingMode: 'environment' }}
                  />
                </div>
              </>
            )}
            {cameraState === 'unavailable' && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
                {t('scanner.cameraUnavailable')}
              </div>
            )}
            {cameraState === 'probing' && (
              <div className="animate-pulse h-48 bg-gray-100 rounded-lg" />
            )}
          </section>
        )}

        {/* Manual state */}
        {activeTab === 'manual' && (
          <section aria-label={t('tabs.manual')} className="bg-white rounded-xl shadow-sm p-4">
            <label className="block">
              <span className="sr-only">{t('manual.searchPlaceholder')}</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('manual.searchPlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>

            {rosterError && (
              <div role="alert" className="mt-3 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded">
                {rosterError}
              </div>
            )}

            <ul className="mt-3 divide-y divide-gray-200">
              {filteredRoster.length === 0 && !rosterError && (
                <li className="py-6 text-center text-sm text-gray-500">{t('manual.noResults')}</li>
              )}
              {filteredRoster.map((row) => (
                <li key={row.registrationId} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{row.participantName}</div>
                    {row.isCheckedIn && row.checkedInAt && (
                      <div className="text-xs text-gray-500">
                        {t('result.alreadyCheckedIn', {
                          name: row.participantName,
                          time: new Date(row.checkedInAt).toLocaleTimeString('de-CH'),
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleManualCheckIn(row.registrationId)}
                    disabled={actionInFlight === row.registrationId}
                    className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    {t('manual.checkInButton')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

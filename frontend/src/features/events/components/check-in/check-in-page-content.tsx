/**
 * REQ-023 (E3.S2): Event check-in composition root (E24-S3 slice extraction).
 *
 * Behaviour-preserving extraction of the ~401-line god-page
 * (`app/(dashboard)/events/[id]/check-in/page.tsx`). The three UI states are
 * unchanged:
 *   - Scanner: live QR scanning via the slice-local `<CheckInScanner />` (which
 *     holds the SSR-guarded dynamic `@yudiel/react-qr-scanner` import). Auto-
 *     flips to manual on camera unavailability.
 *   - Manual: name search over the roster, filtered client-side (250ms debounce).
 *   - Result: shared banner distinguishing a real check-in from an idempotent
 *     already-checked-in return per CheckInResultDto.
 *
 * DEC-2 (the ONLY thing that moved): TRANSPORT. The three `events`
 * calls (`getEventCheckInRoster` / `checkInByQrCode` / `manualCheckIn`) are now
 * the slice hooks `useCheckInRoster` / `useQrCheckIn` / `useManualCheckIn` over
 * `useApiClient`. Every behaviour — camera probe, tabs, debounce + client filter,
 * `lastScannedToken` dedupe, `refreshKey` reload-after-success / no-reload-on-
 * failure, the full outcome-banner matrix, `scanAgain`, `actionInFlight`,
 * `loadRosterFailed`, the role guard + `/login`/null redirects — is reproduced
 * verbatim.
 *
 * Backend RequireEventStaff is the security boundary; the role guard here is UX-only.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { useCheckInRoster } from "../../hooks/use-check-in-roster";
import { useQrCheckIn } from "../../hooks/use-qr-check-in";
import { useManualCheckIn } from "../../hooks/use-manual-check-in";
import { CheckInScanner } from "./check-in-scanner";
import type {
  CheckInResultDto,
  EventCheckInRosterItemDto,
} from "../../types/events.types";

type Tab = "scanner" | "manual";
type CameraState = "probing" | "available" | "unavailable";

interface CheckInPageContentProps {
  id: string;
}

export function CheckInPageContent({ id: eventId }: CheckInPageContentProps) {
  const router = useRouter();
  const t = useTranslations("events.checkIn");
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
    roles,
  } = useAuth();
  const isEventManager = roles.includes("event-manager");
  const canAccess = isVorstand || isAdmin || isEventManager;

  const [activeTab, setActiveTab] = useState<Tab>("scanner");
  const [cameraState, setCameraState] = useState<CameraState>("probing");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  // DEC-2 transport: roster server state now flows through the slice hook
  // (refreshKey-keyed reload preserved; `canAccess` gates the load).
  const { roster, error: rosterError } = useCheckInRoster(
    eventId,
    refreshKey,
    canAccess,
    t("manual.loadRosterFailed")
  );
  const runQrCheckIn = useQrCheckIn(eventId);
  const runManualCheckIn = useManualCheckIn(eventId);

  // Auth guard.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Camera probe; auto-flip to manual on failure.
  useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        if (!cancelled) {
          setCameraState("unavailable");
          setActiveTab("manual");
        }
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        // Release the probe stream immediately — the scanner component re-acquires when mounted.
        stream.getTracks().forEach((track) => track.stop());
        if (!cancelled) setCameraState("available");
      } catch {
        if (!cancelled) {
          setCameraState("unavailable");
          setActiveTab("manual");
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

  const filteredRoster: EventCheckInRosterItemDto[] = useMemo(() => {
    if (!roster) return [];
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return roster.items;
    return roster.items.filter((r) =>
      r.participantName.toLowerCase().includes(q)
    );
  }, [roster, debouncedSearch]);

  // Post-review M-S2-5: a single decoder/permission glitch should NOT permanently disable
  // the scanner. Surface a transient error banner but keep the tab active; only the camera
  // probe (true unavailable) flips us to manual permanently.
  const handleScannerError = useCallback(() => {
    setNetworkError(t("scanner.transientError"));
  }, [t]);

  const handleQrDecode = useCallback(
    async (rawValue: string) => {
      if (!rawValue || actionInFlight === "qr") return;
      // Post-review M-S2-3: dedupe the same token within the same scanner session. The user
      // explicitly resets by clicking "scan again" on the invalid-QR banner or by closing the
      // result banner (which clears lastScannedToken).
      if (rawValue === lastScannedToken) return;
      setLastScannedToken(rawValue);
      setActionInFlight("qr");
      setInvalidQrToken(null);
      setNetworkError(null);
      const outcome = await runQrCheckIn(rawValue);
      if (outcome.kind === "result") {
        setResult(outcome.result);
        setRefreshKey((k) => k + 1);
      } else if (outcome.kind === "networkError") {
        // Post-review M-S2-4: 5xx / network failures previously fell through silently.
        setNetworkError(t("scanner.networkError"));
      } else {
        setResult(null);
        setInvalidQrToken(rawValue.slice(0, 8));
      }
      setActionInFlight(null);
    },
    [actionInFlight, lastScannedToken, runQrCheckIn, t]
  );

  const handleManualCheckIn = useCallback(
    async (registrationId: string) => {
      setActionInFlight(registrationId);
      setNetworkError(null);
      const outcome = await runManualCheckIn(
        registrationId,
        debouncedSearch || undefined
      );
      if (outcome.kind === "result") {
        setResult(outcome.result);
        setRefreshKey((k) => k + 1);
      } else {
        // Post-review M-S2-4: same network-error guarding as QR.
        setNetworkError(t("manual.checkInFailed"));
      }
      setActionInFlight(null);
    },
    [debouncedSearch, runManualCheckIn, t]
  );

  if (authLoading) {
    return (
      <PageShell maxWidth="5xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-96 animate-pulse rounded-xl bg-gray-200" />
      </PageShell>
    );
  }

  if (!isAuthenticated) return null;

  if (!canAccess) {
    return (
      <PageShell maxWidth="5xl">
        <div
          role="alert"
          className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800"
        >
          {t("forbidden")}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="5xl">
      <Link
        href={`/events/${eventId}`}
        className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-orange-600"
      >
        ← {t("title")}
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-1 text-gray-500">{t("subtitle")}</p>
      </header>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("scanner")}
          disabled={cameraState === "unavailable"}
          aria-pressed={activeTab === "scanner"}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            activeTab === "scanner"
              ? "border-orange-600 text-orange-700"
              : "border-transparent text-gray-600 hover:text-orange-600"
          }`}
        >
          {t("tabs.scanner")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          aria-pressed={activeTab === "manual"}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "manual"
              ? "border-orange-600 text-orange-700"
              : "border-transparent text-gray-600 hover:text-orange-600"
          }`}
        >
          {t("tabs.manual")}
        </button>
      </div>

      {/* Result card */}
      {result?.registration && (
        <div
          role="status"
          className={`mb-4 rounded-lg border px-4 py-3 ${
            result.outcome === "CheckedIn"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : result.outcome === "AlreadyCheckedIn"
                ? "border-orange-200 bg-orange-50 text-orange-800"
                : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.outcome === "CheckedIn" &&
            t("result.checkedIn", {
              name: result.registration.participantName,
            })}
          {result.outcome === "AlreadyCheckedIn" &&
            t("result.alreadyCheckedIn", {
              name: result.registration.participantName,
              time: result.registration.checkedInAt
                ? new Date(result.registration.checkedInAt).toLocaleTimeString(
                    "de-CH"
                  )
                : "?",
            })}
          {result.outcome === "Conflict" &&
            result.conflict === "Cancelled" &&
            t("result.cancelledConflict")}
          {result.outcome === "Conflict" &&
            result.conflict === "Waitlisted" &&
            t("result.waitlistedConflict")}
        </div>
      )}

      {/* Post-review M-S2-4 / M-S2-5: transient network or scanner error banner */}
      {networkError && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <span>{networkError}</span>
          <button
            type="button"
            onClick={() => {
              setNetworkError(null);
              setLastScannedToken(null);
            }}
            className="text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            {t("scanner.scanAgain")}
          </button>
        </div>
      )}

      {/* Invalid QR banner */}
      {invalidQrToken && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800"
        >
          <span>{t("scanner.invalidQr", { token: invalidQrToken })}</span>
          <button
            type="button"
            onClick={() => {
              setInvalidQrToken(null);
              setLastScannedToken(null);
            }}
            className="text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            {t("scanner.scanAgain")}
          </button>
        </div>
      )}

      {/* Scanner state */}
      {activeTab === "scanner" && (
        <section
          aria-label={t("tabs.scanner")}
          className="rounded-xl bg-white p-4 shadow-sm"
        >
          {cameraState === "available" && (
            <>
              <p className="mb-3 text-sm text-gray-600">{t("scanner.ready")}</p>
              <div className="mx-auto max-w-md">
                <CheckInScanner
                  onScan={handleQrDecode}
                  onError={handleScannerError}
                />
              </div>
            </>
          )}
          {cameraState === "unavailable" && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800">
              {t("scanner.cameraUnavailable")}
            </div>
          )}
          {cameraState === "probing" && (
            <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
          )}
        </section>
      )}

      {/* Manual state */}
      {activeTab === "manual" && (
        <section
          aria-label={t("tabs.manual")}
          className="rounded-xl bg-white p-4 shadow-sm"
        >
          <label className="block">
            <span className="sr-only">{t("manual.searchPlaceholder")}</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("manual.searchPlaceholder")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </label>

          {rosterError && (
            <div
              role="alert"
              className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800"
            >
              {rosterError}
            </div>
          )}

          <ul className="mt-3 divide-y divide-gray-200">
            {filteredRoster.length === 0 && !rosterError && (
              <li className="py-6 text-center text-sm text-gray-500">
                {t("manual.noResults")}
              </li>
            )}
            {filteredRoster.map((row) => (
              <li
                key={row.registrationId}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {row.participantName}
                  </div>
                  {row.isCheckedIn && row.checkedInAt && (
                    <div className="text-xs text-gray-500">
                      {t("result.alreadyCheckedIn", {
                        name: row.participantName,
                        time: new Date(row.checkedInAt).toLocaleTimeString(
                          "de-CH"
                        ),
                      })}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleManualCheckIn(row.registrationId)}
                  disabled={actionInFlight === row.registrationId}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {t("manual.checkInButton")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}

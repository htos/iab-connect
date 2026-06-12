"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { settingsKeys, settingsUrls } from "../api/settings-api";
import type {
  FinanceProfilePayload,
  SettingsFinanceProfile,
} from "../types/settings.types";

/**
 * Finance-profile read (E26-S6). The god-page GET resolves `{ data, error, status }`:
 *   - status 404 → "create mode" (profile === null; the form keeps DEFAULT_FORM).
 *   - other error → loadError banner.
 *   - data → existing profile (PUT /{id} on save).
 *
 * A97: `enabled` MATCHES the god-page fetch gate (`!authLoading && canReadFinance`). The query
 * returns `{ profile, loadError }` so the content can branch POST-vs-PUT from the loaded-profile
 * presence and surface the loadError exactly as the god-page did (404 is NOT a loadError).
 */
export interface ProfileQueryResult {
  profile: SettingsFinanceProfile | null;
  loadError: boolean;
}

export function useFinanceProfile(enabled: boolean) {
  const api = useApiClient();
  return useQuery<ProfileQueryResult>({
    queryKey: settingsKeys.profile(),
    enabled,
    queryFn: async () => {
      const res = await api.get<SettingsFinanceProfile>(settingsUrls.profile());
      if (res.status === 404) return { profile: null, loadError: false };
      if (res.error || !res.data) return { profile: null, loadError: true };
      return { profile: res.data, loadError: false };
    },
  });
}

/**
 * Create/update the finance profile (E26-S6). The POST-vs-PUT branch is chosen from the loaded
 * profile presence (404 → POST /profile; existing → PUT /profile/{id}) — byte-identical to the
 * god-page. The mutationFn THROWS on `res.error || !res.data` (so the content's error path shows
 * `saveError` and does NOT dispatch the event); on success it dispatches the cross-page
 * `finance-profile-changed` CustomEvent (A56 — emitted on SUCCESS only) and seeds the profile
 * cache with the returned DTO, then invalidates so a re-mount re-reads.
 */
export function useSaveFinanceProfile() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<
    SettingsFinanceProfile,
    Error,
    { profileId: string | null; payload: FinanceProfilePayload }
  >({
    mutationFn: async ({ profileId, payload }) => {
      const res = profileId
        ? await api.put<SettingsFinanceProfile>(
            settingsUrls.profileById(profileId),
            payload
          )
        : await api.post<SettingsFinanceProfile>(
            settingsUrls.profile(),
            payload
          );
      if (res.error || !res.data) {
        throw new Error(res.error ?? "Save failed");
      }
      return res.data;
    },
    onSuccess: (data) => {
      // Cross-page listener (the hub + other finance pages re-read the mode on this event).
      window.dispatchEvent(new CustomEvent("finance-profile-changed"));
      queryClient.setQueryData<ProfileQueryResult>(settingsKeys.profile(), {
        profile: data,
        loadError: false,
      });
    },
  });
}

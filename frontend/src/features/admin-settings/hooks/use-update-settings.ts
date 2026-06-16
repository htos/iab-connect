"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import {
  adminSettingsKeys,
  updateSettings,
  uploadLogo,
} from "../api/admin-settings-api";
import type { UpdateSettingsRequest } from "../types/admin-settings.types";

/**
 * A failed logo upload after a successful profile PUT. Carrying a distinct error
 * lets the form drive the `LogoUploadState` machine to `"failed"` AND surface the
 * `logoUploadFailed` banner, exactly like the god-page (which set both).
 */
export class LogoUploadError extends Error {
  constructor() {
    super("logoUploadFailed");
    this.name = "LogoUploadError";
  }
}

export interface UpdateSettingsVariables {
  body: UpdateSettingsRequest;
  // Staged logo (the SECOND request). When present, the profile PUT is followed by
  // the logo POST — byte-identical to the god-page save flow.
  logoFile: File | null;
}

/**
 * Branding save mutation (E27-S3, A79). Preserves the god-page's two-request save:
 * PUT `/api/v1/settings`, then — only when a logo is staged — POST
 * `/api/v1/settings/logo`. A profile PUT error throws a plain Error (→ `saveError`);
 * a logo error throws `LogoUploadError` (→ `logoUploadFailed` + the failed
 * sub-state). On success it invalidates the settings query (re-fetch, replacing the
 * god-page's manual `loadSettings()`) AND calls `refreshAppSettings()` so the global
 * `AppSettingsProvider` (logo/sidebar) does not go stale.
 */
export function useUpdateSettings() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { refresh: refreshAppSettings } = useAppSettings();
  return useMutation({
    mutationFn: async ({ body, logoFile }: UpdateSettingsVariables) => {
      const result = await updateSettings(api, body);
      if (result.error) throw new Error(result.error);
      if (logoFile) {
        const logoResult = await uploadLogo(api, logoFile);
        if (logoResult.error) throw new LogoUploadError();
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: adminSettingsKeys.settings,
      });
      refreshAppSettings();
    },
  });
}

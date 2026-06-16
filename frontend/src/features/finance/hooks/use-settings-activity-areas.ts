"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { settingsKeys, settingsUrls } from "../api/settings-api";
import type {
  ActivityArea,
  ActivityAreaPayloadBase,
} from "../types/settings.types";
import type { SettingsActivityAreaFormValues } from "../schemas/settings-activity-area.schema";

/**
 * SETTINGS activity-areas CRUD (E26-S6, DEC-3 = A). REUSES the foundation's `ActivityArea` type
 * + the foundation's activity-areas CRUD URL builders/keys (single owner; the settings PAGE is a
 * distinct route from S4's budgeting `finance/activity-areas`). The hardcoded-English error
 * strings are preserved VERBATIM (A56 — do NOT translate): the GET catch maps a thrown/rejected
 * promise to "Failed to load activity areas"; a `res.error` is surfaced verbatim ("boom"); save
 * → "Failed to save activity area"; delete → "Failed to delete activity area".
 *
 * The settings create payload OMITS `isActive`; edit hard-codes `isActive: true` (DEC-3). A96:
 * the `"" → null` optional mapping for description/color lives here at the wire boundary.
 */

const LOAD_ERROR = "Failed to load activity areas";
const SAVE_ERROR = "Failed to save activity area";
const DELETE_ERROR = "Failed to delete activity area";

export function useSettingsActivityAreas(enabled: boolean) {
  const api = useApiClient();
  return useQuery<ActivityArea[]>({
    queryKey: settingsKeys.activityAreas(),
    enabled,
    queryFn: async () => {
      let res;
      try {
        res = await api.get<ActivityArea[]>(settingsUrls.activityAreas());
      } catch {
        // A56: the god-page catch sets the LITERAL English string (not res.error).
        throw new Error(LOAD_ERROR);
      }
      // A56: a res.error field is surfaced verbatim (the god-page sets setError(response.error)).
      if (res.error) throw new Error(res.error);
      const body = res.data as unknown as { items?: ActivityArea[] };
      return body?.items ?? [];
    },
  });
}

/** Map the form to the base wire payload. A96: optionals `"" → null`; required untrimmed. */
function formToBasePayload(
  values: SettingsActivityAreaFormValues
): ActivityAreaPayloadBase {
  return {
    name: values.name,
    code: values.code,
    description: values.description || null,
    color: values.color || null,
    sortOrder: values.sortOrder,
  };
}

export function useSaveSettingsActivityArea() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { id: string | null; values: SettingsActivityAreaFormValues }
  >({
    mutationFn: async ({ id, values }) => {
      const base = formToBasePayload(values);
      // DEC-3: create OMITS isActive; edit hard-codes isActive: true.
      const res = id
        ? await api.put(settingsUrls.activityArea(id), {
            ...base,
            isActive: true,
          })
        : await api.post(settingsUrls.activityAreas(), base);
      if (res.error) throw new Error(SAVE_ERROR);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.activityAreas() }),
  });
}

export function useDeleteSettingsActivityArea() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const res = await api.delete(settingsUrls.activityArea(id));
      if (res.error) throw new Error(DELETE_ERROR);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.activityAreas() }),
  });
}

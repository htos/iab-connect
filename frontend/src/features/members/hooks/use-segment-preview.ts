"use client";

import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { previewSegment } from "../api/member-segments-api";
import type { PreviewResult } from "../types/member-segment.types";

/**
 * Preview the members matched by a Dynamic segment's criteria JSON. A mutation
 * (not a query) because it is fired on demand by the form's Preview button.
 * Throws on API error so the form surfaces it in the banner.
 */
export function useSegmentPreview() {
  const api = useApiClient();
  return useMutation<PreviewResult, Error, string>({
    mutationFn: async (criteriaJson) => {
      const result = await previewSegment(api, criteriaJson);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
  });
}

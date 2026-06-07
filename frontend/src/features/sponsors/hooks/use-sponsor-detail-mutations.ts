"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  addLink,
  addPackage,
  removeLink,
  removePackage,
  sponsorsKeys,
  updateSponsorStatus,
} from "../api/sponsors-api";
import type {
  AddLinkRequest,
  AddPackageRequest,
  SponsorDetailDto,
  SponsorStatus,
} from "../types/sponsor.types";

/**
 * Detail-page mutations (E22-S3, DEC-2=A): status change + inline package/link
 * CRUD. Each endpoint returns the updated `SponsorDetailDto`; on success we write
 * it straight into the detail query cache via `setQueryData` — preserving the
 * god-page's "the mutation response updates the view, no extra GET" semantics
 * (A79), rather than invalidating and refetching. Each mutation throws on API
 * error so the caller can `alert()` (the god-page error behaviour).
 */
export function useSponsorDetailMutations(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const writeDetail = (data: SponsorDetailDto | null) => {
    if (data) queryClient.setQueryData(sponsorsKeys.detail(id), data);
  };

  const changeStatus = useMutation({
    mutationFn: async (status: SponsorStatus) => {
      const result = await updateSponsorStatus(api, id, status);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: writeDetail,
  });

  const addPackageMutation = useMutation({
    mutationFn: async (body: AddPackageRequest) => {
      const result = await addPackage(api, id, body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: writeDetail,
  });

  const removePackageMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const result = await removePackage(api, id, packageId);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: writeDetail,
  });

  const addLinkMutation = useMutation({
    mutationFn: async (body: AddLinkRequest) => {
      const result = await addLink(api, id, body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: writeDetail,
  });

  const removeLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const result = await removeLink(api, id, linkId);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: writeDetail,
  });

  return {
    changeStatus,
    addPackage: addPackageMutation,
    removePackage: removePackageMutation,
    addLink: addLinkMutation,
    removeLink: removeLinkMutation,
  };
}

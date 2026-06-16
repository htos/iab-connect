"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  addLink,
  removeLink,
  suppliersKeys,
  updateSupplierStatus,
} from "../api/suppliers-api";
import type {
  AddLinkRequest,
  SupplierDetailDto,
  SupplierStatus,
} from "../types/supplier.types";

/**
 * Detail-page mutations (E22-S4): status change + inline contract-link CRUD
 * (suppliers have NO packages, unlike sponsors). Each endpoint returns the
 * updated `SupplierDetailDto`; on success we write it straight into the detail
 * query cache via `setQueryData` — preserving the god-page's "the mutation
 * response updates the view, no extra GET" semantics (A79). Each mutation throws
 * on API error so the caller can `alert()` (the god-page error behaviour).
 */
export function useSupplierDetailMutations(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const writeDetail = (data: SupplierDetailDto | null) => {
    if (data) queryClient.setQueryData(suppliersKeys.detail(id), data);
  };

  const changeStatus = useMutation({
    mutationFn: async (status: SupplierStatus) => {
      const result = await updateSupplierStatus(api, id, status);
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
    addLink: addLinkMutation,
    removeLink: removeLinkMutation,
  };
}

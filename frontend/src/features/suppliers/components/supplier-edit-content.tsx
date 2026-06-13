"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { useSupplier } from "../hooks/use-supplier";
import { useUpdateSupplier } from "../hooks/use-update-supplier";
import { SupplierForm } from "./supplier-form";
import type { SupplierFormValues } from "../schemas/supplier.schema";
import type { SupplierDetailDto } from "../types/supplier.types";

const EMPTY_VALUES: SupplierFormValues = {
  companyName: "",
  contactPerson: "",
  category: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
};

function toFormValues(data: SupplierDetailDto): SupplierFormValues {
  return {
    companyName: data.companyName,
    contactPerson: data.contactPerson ?? "",
    category: data.category ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    website: data.website ?? "",
    notes: data.notes ?? "",
  };
}

/**
 * Edit-supplier composition root (E22-S4) — the only `"use client"` boundary for
 * `/suppliers/[id]/edit`. The GET prefill is a TanStack query (`use-supplier`);
 * the form mounts only once the data has loaded so its `defaultValues` prefill the
 * fields. Admin-only guard, update→redirect→list flow, and API-error banner.
 */
export function SupplierEditContent() {
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;
  const t = useTranslations();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
    if (!authLoading && isAuthenticated && !isAdmin) router.push("/");
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const {
    data: supplier,
    isLoading: loading,
    error: queryError,
  } = useSupplier(supplierId, isAuthenticated && isAdmin);
  const updateMutation = useUpdateSupplier(supplierId);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  const handleSubmit = (values: SupplierFormValues) => {
    updateMutation.mutate(values, {
      onSuccess: () => router.push("/suppliers"),
    });
  };

  const errorMessage =
    updateMutation.error?.message ?? queryError?.message ?? null;

  return (
    <PageShell maxWidth="2xl">
      <div className="mb-8">
        <Link
          href="/suppliers"
          className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("common.backToList")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          {t("suppliers.editSupplier")}
        </h1>
      </div>

      <SupplierForm
        defaultValues={supplier ? toFormValues(supplier) : EMPTY_VALUES}
        onSubmit={handleSubmit}
        submitLabel="common.save"
        pending={updateMutation.isPending}
        errorMessage={errorMessage}
      />
    </PageShell>
  );
}

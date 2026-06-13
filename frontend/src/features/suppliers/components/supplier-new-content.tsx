"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { useCreateSupplier } from "../hooks/use-create-supplier";
import { SupplierForm } from "./supplier-form";
import type { SupplierFormValues } from "../schemas/supplier.schema";

const EMPTY_VALUES: SupplierFormValues = {
  companyName: "",
  contactPerson: "",
  category: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
};

/**
 * New-supplier composition root (E22-S4) — the only `"use client"` boundary for
 * `/suppliers/new`. Admin-only guard + create→redirect→list flow preserved; the
 * form mechanism is now the shared RHF+Zod sub-recipe.
 */
export function SupplierNewContent() {
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const t = useTranslations();
  const createMutation = useCreateSupplier();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
    if (!authLoading && isAuthenticated && !isAdmin) router.push("/");
  }, [authLoading, isAuthenticated, isAdmin, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  const handleSubmit = (values: SupplierFormValues) => {
    createMutation.mutate(values, {
      onSuccess: () => router.push("/suppliers"),
    });
  };

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
          {t("suppliers.newSupplier")}
        </h1>
        <p className="mt-1 text-gray-600">{t("suppliers.addSupplierDesc")}</p>
      </div>

      <SupplierForm
        defaultValues={EMPTY_VALUES}
        onSubmit={handleSubmit}
        submitLabel="suppliers.createSupplier"
        pending={createMutation.isPending}
        errorMessage={createMutation.error?.message ?? null}
      />
    </PageShell>
  );
}

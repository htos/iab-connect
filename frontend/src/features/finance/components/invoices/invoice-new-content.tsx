"use client";

/**
 * New-invoice content (E26-S3 migration of `app/finance/invoices/new/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Write-gated page (A56): reads `canWriteFinance` ONLY; useEffect → `router.replace
 * ("/finance/invoices")`; render-time `if (!canWriteFinance) return null`. The form is the
 * shared RHF+Zod sub-recipe (A95 recipientType full-union round-trip; A96 no-trim;
 * A98 Draft/Send + create-navigate + Member/Other conditional fields). The create body is
 * assembled here byte-identically to the god-page; on success the content navigates from
 * the mutation OUTCOME (A92), so a failed POST keeps the form intact + shows the error.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { InvoiceForm } from "./invoice-form";
import { useCreateInvoice } from "../../hooks/use-invoice-detail";
import {
  useInvoiceActivityAreas,
  useInvoiceTaxCodes,
  useMemberLookup,
} from "../../hooks/use-invoice-form-lookups";
import type { InvoiceFormValues } from "../../schemas/invoice.schema";

const toDateInputValue = (date: Date) => date.toISOString().split("T")[0];

function buildDefaults(): InvoiceFormValues {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  return {
    date: toDateInputValue(today),
    dueDate: toDateInputValue(due),
    recipientType: "Member",
    recipientId: "",
    recipientName: "",
    recipientAddress: "",
    items: [
      {
        description: "",
        quantity: 1,
        unitPrice: 0,
        taxCodeId: "",
        taxRate: 0,
        isGrossEntry: false,
        activityAreaId: "",
      },
    ],
  };
}

function InvoiceNewBody() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canWriteFinance } = useAuth();

  const [error, setError] = useState<string | null>(null);
  // Drives the members fetch lazily — the god-page only fetched members when
  // recipientType === "Member" (the initial value), then on each switch back.
  const [recipientType, setRecipientType] = useState("Member");

  const createMutation = useCreateInvoice();

  const taxCodes = useInvoiceTaxCodes(true).data ?? [];
  const activityAreas = useInvoiceActivityAreas(true).data ?? [];
  const membersQuery = useMemberLookup(recipientType === "Member");
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);

  useEffect(() => {
    if (!canWriteFinance) {
      router.replace("/finance/invoices");
    }
  }, [canWriteFinance, router]);

  const handleRecipientTypeChange = useCallback((value: string) => {
    setRecipientType(value);
  }, []);

  const handleSubmit = useCallback(
    (values: InvoiceFormValues, sendAfterCreate: boolean) => {
      setError(null);
      // Assemble the POST body byte-identically to the god-page (A95/A96 — raw bytes,
      // recipientType POSTed verbatim incl. "Other"; recipientName derived from the
      // selected member when Member, raw input otherwise; recipientId/address only on the
      // matching branch).
      const selectedMember =
        values.recipientType === "Member"
          ? members.find((m) => m.id === values.recipientId)
          : undefined;
      const body = {
        date: values.date,
        dueDate: values.dueDate,
        recipientType: values.recipientType,
        recipientId:
          values.recipientType === "Member" ? values.recipientId : undefined,
        recipientName:
          values.recipientType === "Member"
            ? selectedMember
              ? `${selectedMember.firstName} ${selectedMember.lastName}`
              : ""
            : values.recipientName,
        recipientAddress:
          values.recipientType === "Other"
            ? values.recipientAddress
            : undefined,
        items: values.items.map(
          ({
            description,
            quantity,
            unitPrice,
            taxCodeId,
            isGrossEntry,
            activityAreaId,
          }) => ({
            description,
            quantity,
            unitPrice,
            taxCodeId: taxCodeId || null,
            isGrossEntry,
            activityAreaId: activityAreaId || null,
          })
        ),
      };

      createMutation.mutate(
        { body, sendAfterCreate },
        {
          onSuccess: (createdId) =>
            router.push(`/finance/invoices/${createdId}`),
          onError: () => setError(t("errorCreatingInvoice")),
        }
      );
    },
    [members, createMutation, router, t]
  );

  if (!canWriteFinance) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/finance" className="hover:text-orange-600">
          {t("title")}
        </Link>
        <span>/</span>
        <Link href="/finance/invoices" className="hover:text-orange-600">
          {t("invoices")}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{t("newInvoice")}</span>
      </nav>

      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900">{t("newInvoice")}</h1>

      <InvoiceForm
        defaultValues={buildDefaults()}
        members={members}
        membersLoading={membersQuery.isLoading && recipientType === "Member"}
        taxCodes={taxCodes}
        activityAreas={activityAreas}
        loading={createMutation.isPending}
        onRecipientTypeChange={handleRecipientTypeChange}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export function InvoiceNewContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <InvoiceNewBody />
    </QueryClientProvider>
  );
}

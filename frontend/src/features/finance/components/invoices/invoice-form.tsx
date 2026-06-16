"use client";

/**
 * Shared invoice new/edit form — the E22 RHF+Zod sub-recipe applied to the invoice form
 * (E26-S3). The epic's primary RHF+Zod showcase; it carries the A95 `recipientType
 * "Other"` trap.
 *
 * A95: `recipientType` is the FULL transport union (`z.string()`); the RAW stored value
 * is kept in `defaultValues` and rendered as an extra `<option>` when it is out of the
 * rendered set ("Member"/"Other") — so a no-touch edit-save round-trips it byte-identically.
 * A96: NO `.trim()` on any submitted-byte field — recipientName/address/line descriptions
 * are sent as typed; the schema is permissive (matches the god-page's only enable-gate,
 * `disabled={loading}`). `<form noValidate>` renders any per-field Zod error (there are
 * none for the inputs the god-page accepted).
 * A98: mode-divergent surfaces threaded through props — the Draft/Send submit buttons, the
 * create→`router.push('/finance/invoices/{id}')` navigation (driven by the content from the
 * mutation OUTCOME), and the Member-vs-Other conditional recipient fields. Line-items editor
 * + live VAT calc (net/tax/gross, isGrossEntry back-out) preserved.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { formatCHF } from "@/lib/utils";
import {
  invoiceFormSchema,
  type InvoiceFormValues,
} from "../../schemas/invoice.schema";
import type {
  InvoiceActivityArea,
  InvoiceTaxCode,
  MemberLookup,
} from "../../types/receivables.types";

interface InvoiceFormProps {
  defaultValues: InvoiceFormValues;
  members: MemberLookup[];
  membersLoading: boolean;
  taxCodes: InvoiceTaxCode[];
  activityAreas: InvoiceActivityArea[];
  loading: boolean;
  // A98: mode-divergent — recipientType change toggles the member lookup fetch in the
  // content; report it so the content can enable the members query.
  onRecipientTypeChange: (value: string) => void;
  // A92: the content drives navigation from the mutation OUTCOME — the form just hands
  // back the assembled values; the content builds the body + mutates.
  onSubmit: (values: InvoiceFormValues, sendAfterCreate: boolean) => void;
}

const emptyItem = () => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxCodeId: "",
  taxRate: 0,
  isGrossEntry: false,
  activityAreaId: "",
});

function calcItemAmounts(item: {
  quantity: number;
  unitPrice: number;
  taxRate: number;
  isGrossEntry: boolean;
}) {
  const lineTotal = item.quantity * item.unitPrice;
  const rate = item.taxRate;
  if (rate === 0) return { net: lineTotal, tax: 0, gross: lineTotal };
  if (item.isGrossEntry) {
    const gross = lineTotal;
    const net = gross / (1 + rate / 100);
    const tax = gross - net;
    return { net, tax, gross };
  }
  const net = lineTotal;
  const tax = net * (rate / 100);
  return { net, tax, gross: net + tax };
}

export function InvoiceForm({
  defaultValues,
  members,
  membersLoading,
  taxCodes,
  activityAreas,
  loading,
  onRecipientTypeChange,
  onSubmit,
}: InvoiceFormProps) {
  const t = useTranslations("finance");
  const tv = useTranslations("finance.vat");

  const { register, handleSubmit, control, setValue } =
    useForm<InvoiceFormValues>({
      resolver: zodResolver(invoiceFormSchema),
      defaultValues,
    });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // Live-watch the dynamic surfaces (recipient conditional + line-item totals).
  const recipientType = useWatch({ control, name: "recipientType" });
  const watchedItems = useWatch({ control, name: "items" }) ?? [];

  // A95: render the raw stored recipientType as an extra option when it is out of the
  // rendered {Member, Other} set (e.g. the canonical "External" on an edit-load).
  const renderedTypes = ["Member", "Other"];
  const showExtraTypeOption =
    !!recipientType && !renderedTypes.includes(recipientType);

  // Report recipientType changes upward (drives the members fetch in the content).
  useEffect(() => {
    onRecipientTypeChange(recipientType);
  }, [recipientType, onRecipientTypeChange]);

  const totals = watchedItems.reduce(
    (acc, item) => {
      const amounts = calcItemAmounts({
        quantity: Number(item?.quantity) || 0,
        unitPrice: Number(item?.unitPrice) || 0,
        taxRate: Number(item?.taxRate) || 0,
        isGrossEntry: !!item?.isGrossEntry,
      });
      acc.totalNet += amounts.net;
      acc.totalTax += amounts.tax;
      acc.totalGross += amounts.gross;
      return acc;
    },
    { totalNet: 0, totalTax: 0, totalGross: 0 }
  );

  const submit = (sendAfterCreate: boolean) =>
    handleSubmit((values) => onSubmit(values, sendAfterCreate))();

  return (
    <form
      noValidate
      className="space-y-6 p-6"
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Invoice Details Card */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t("invoiceDetails")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("date")}
            </label>
            <input
              type="date"
              {...register("date")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("dueDate")}
            </label>
            <input
              type="date"
              {...register("dueDate")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          {/* Recipient Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("recipientType")}
            </label>
            <select
              {...register("recipientType")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
            >
              <option value="Member">{t("recipientTypeMember")}</option>
              <option value="Other">{t("recipientTypeExternal")}</option>
              {/* A95: render the out-of-set raw value so a no-touch edit round-trips it. */}
              {showExtraTypeOption && (
                <option value={recipientType}>{recipientType}</option>
              )}
            </select>
          </div>

          {/* Spacer */}
          <div />

          {/* Recipient Selection */}
          {recipientType === "Member" ? (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("selectMember")}
              </label>
              <select
                {...register("recipientId")}
                disabled={membersLoading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500 disabled:opacity-50"
              >
                <option value="">{t("selectMemberPlaceholder")}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("recipientName")}
                </label>
                <input
                  type="text"
                  {...register("recipientName")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                  placeholder={t("recipientNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("recipientAddress")}
                </label>
                <textarea
                  {...register("recipientAddress")}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                  placeholder={t("recipientAddressPlaceholder")}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Line Items Section */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("lineItems")}
          </h2>
          <button
            type="button"
            onClick={() => append(emptyItem())}
            className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
          >
            {t("addItem")}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-3 font-medium">{t("description")}</th>
                <th className="w-20 pb-3 text-right font-medium">
                  {t("quantity")}
                </th>
                <th className="w-28 pb-3 text-right font-medium">
                  {t("unitPrice")}
                </th>
                <th className="w-36 pb-3 font-medium">{tv("taxCode")}</th>
                <th className="w-20 pb-3 text-center font-medium">
                  {tv("isGrossEntry")}
                </th>
                <th className="w-36 pb-3 font-medium">{t("activityArea")}</th>
                <th className="w-28 pb-3 text-right font-medium">
                  {tv("net")}
                </th>
                <th className="w-24 pb-3 text-right font-medium">
                  {tv("tax")}
                </th>
                <th className="w-28 pb-3 text-right font-medium">
                  {tv("gross")}
                </th>
                <th className="w-12 pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fields.map((field, index) => {
                const watched = watchedItems[index] ?? {};
                const amounts = calcItemAmounts({
                  quantity: Number(watched.quantity) || 0,
                  unitPrice: Number(watched.unitPrice) || 0,
                  taxRate: Number(watched.taxRate) || 0,
                  isGrossEntry: !!watched.isGrossEntry,
                });
                return (
                  <tr key={field.id}>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        {...register(`items.${index}.description`)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                        placeholder={t("descriptionPlaceholder")}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        {...register(`items.${index}.quantity`, {
                          valueAsNumber: true,
                        })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        {...register(`items.${index}.unitPrice`, {
                          valueAsNumber: true,
                        })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={watched.taxCodeId ?? ""}
                        onChange={(e) => {
                          const selectedTc = taxCodes.find(
                            (tc) => tc.id === e.target.value
                          );
                          setValue(`items.${index}.taxCodeId`, e.target.value);
                          setValue(
                            `items.${index}.taxRate`,
                            selectedTc ? selectedTc.rate : 0
                          );
                        }}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        <option value="">{tv("noTaxCode")}</option>
                        {taxCodes.map((tc) => (
                          <option key={tc.id} value={tc.id}>
                            {tc.label} ({tc.rate}%)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        {...register(`items.${index}.isGrossEntry`)}
                        disabled={!watched.taxCodeId}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        {...register(`items.${index}.activityAreaId`)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        <option value="">—</option>
                        {activityAreas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-right text-sm text-gray-700">
                      {formatCHF(amounts.net)}
                    </td>
                    <td className="py-2 pr-2 text-right text-sm text-gray-500">
                      {amounts.tax > 0 ? formatCHF(amounts.tax) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right font-medium text-gray-900">
                      {formatCHF(amounts.gross)}
                    </td>
                    <td className="py-2 text-center">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length <= 1}
                        className="text-red-500 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                        title={t("removeItem")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Display */}
        <div className="mt-6 flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{tv("totalNet")}</span>
              <span>{formatCHF(totals.totalNet)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{tv("totalTax")}</span>
              <span>{formatCHF(totals.totalTax)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
              <span>{tv("totalGross")}</span>
              <span>{formatCHF(totals.totalGross)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Buttons (A98: Draft vs Send) */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              {t("saving")}
            </span>
          ) : (
            t("saveAsDraft")
          )}
        </button>
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={loading}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {t("saving")}
            </span>
          ) : (
            t("saveAndSend")
          )}
        </button>
        <Link
          href="/finance/invoices"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}

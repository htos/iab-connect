"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useApiClient } from "@/lib/auth";

interface InvoiceItemForm {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
}

const formatCHF = (amount: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(
    amount
  );

const toDateInputValue = (date: Date) => date.toISOString().split("T")[0];

const emptyItem = (): InvoiceItemForm => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
});

export default function NewInvoicePage() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canWriteFinance } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;

  const today = new Date();
  const defaultDueDate = new Date(today);
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);

  const [date, setDate] = useState(toDateInputValue(today));
  const [dueDate, setDueDate] = useState(toDateInputValue(defaultDueDate));
  const [recipientType, setRecipientType] = useState<"Member" | "External">(
    "Member"
  );
  const [recipientId, setRecipientId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState<InvoiceItemForm[]>([emptyItem()]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    if (!canWriteFinance) {
      router.replace("/finance/invoices");
      return;
    }
  }, [canWriteFinance, router]);

  const fetchMembers = useCallback(async () => {
    try {
      setMembersLoading(true);
      const response = await apiRef.current.get("/api/v1/members");
      if (response.error) throw new Error(response.error);
      setMembers(response.data as Member[]);
    } catch {
      // Non-critical, dropdown will be empty
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (recipientType === "Member") {
      fetchMembers();
    }
  }, [recipientType, fetchMembers]);

  const { subTotal, taxAmount, total } = useMemo(() => {
    const sub = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const tax = sub * (taxRate / 100);
    return { subTotal: sub, taxAmount: tax, total: sub + tax };
  }, [items, taxRate]);

  const updateItem = useCallback(
    (index: number, field: keyof InvoiceItemForm, value: string | number) => {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem()]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSubmit = useCallback(
    async (sendAfterCreate: boolean) => {
      try {
        setLoading(true);
        setError(null);

        const body = {
          date,
          dueDate,
          recipientType,
          recipientId: recipientType === "Member" ? recipientId : undefined,
          recipientName:
            recipientType === "Member"
              ? members.find((m) => m.id === recipientId)
                ? `${members.find((m) => m.id === recipientId)!.firstName} ${members.find((m) => m.id === recipientId)!.lastName}`
                : ""
              : recipientName,
          recipientAddress:
            recipientType === "External" ? recipientAddress : undefined,
          taxRate,
          items: items.map(({ description, quantity, unitPrice }) => ({
            description,
            quantity,
            unitPrice,
          })),
        };

        const response = await apiRef.current.post(
          "/api/v1/finance/invoices",
          body
        );
        if (response.error) throw new Error(response.error);
        const createdId = (response.data as { id: string }).id;

        if (sendAfterCreate) {
          await apiRef.current.post(
            `/api/v1/finance/invoices/${createdId}/send`,
            {}
          );
        }

        router.push(`/finance/invoices/${createdId}`);
      } catch {
        setError(tRef.current("errorCreatingInvoice"));
      } finally {
        setLoading(false);
      }
    },
    [
      date,
      dueDate,
      recipientType,
      recipientId,
      recipientName,
      recipientAddress,
      taxRate,
      items,
      members,
      router,
    ]
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
          {t("finance")}
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
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          {/* Recipient Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("recipientType")}
            </label>
            <select
              value={recipientType}
              onChange={(e) =>
                setRecipientType(e.target.value as "Member" | "External")
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
            >
              <option value="Member">{t("recipientTypeMember")}</option>
              <option value="External">{t("recipientTypeExternal")}</option>
            </select>
          </div>

          {/* Tax Rate */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("taxRate")} (%)
            </label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          {/* Recipient Selection */}
          {recipientType === "Member" ? (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("selectMember")}
              </label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
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
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                  placeholder={t("recipientNamePlaceholder")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("recipientAddress")}
                </label>
                <textarea
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
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
            onClick={addItem}
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
                <th className="w-28 pb-3 text-right font-medium">
                  {t("quantity")}
                </th>
                <th className="w-36 pb-3 text-right font-medium">
                  {t("unitPrice")}
                </th>
                <th className="w-36 pb-3 text-right font-medium">
                  {t("amount")}
                </th>
                <th className="w-12 pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, "description", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                      placeholder={t("descriptionPlaceholder")}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "quantity",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:border-orange-500 focus:ring-orange-500"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "unitPrice",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:border-orange-500 focus:ring-orange-500"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right font-medium text-gray-900">
                    {formatCHF(item.quantity * item.unitPrice)}
                  </td>
                  <td className="py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
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
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Display */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{t("subTotal")}</span>
              <span>{formatCHF(subTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>
                {t("taxRate")} ({taxRate}%)
              </span>
              <span>{formatCHF(taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
              <span>{t("total")}</span>
              <span>{formatCHF(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => handleSubmit(false)}
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
          onClick={() => handleSubmit(true)}
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
    </div>
  );
}

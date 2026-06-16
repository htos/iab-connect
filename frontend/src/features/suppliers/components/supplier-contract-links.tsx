"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { useSupplierDetailMutations } from "../hooks/use-supplier-detail-mutations";
import type { ContractLinkDto } from "@/types/sponsors";

interface SupplierContractLinksProps {
  contractLinks: ContractLinkDto[];
  addLink: ReturnType<typeof useSupplierDetailMutations>["addLink"];
  removeLink: ReturnType<typeof useSupplierDetailMutations>["removeLink"];
}

// Contract-links section of the supplier detail page (E22-S4). Local add-form
// state stays here; the add/remove mutations + cache update live in
// `useSupplierDetailMutations`. Markup + empty state (`suppliers.noLinks`)
// preserved from the god-page. Shared `ContractLink*` types come from
// `@/types/sponsors` (the E21 type split).
export function SupplierContractLinks({
  contractLinks,
  addLink,
  removeLink,
}: SupplierContractLinksProps) {
  const t = useTranslations();
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkType, setLinkType] = useState<"Document" | "Invoice" | "Event">(
    "Document"
  );
  const [linkTargetId, setLinkTargetId] = useState("");
  const [linkDescription, setLinkDescription] = useState("");

  const handleAdd = () => {
    if (!linkTargetId.trim()) return;
    addLink.mutate(
      {
        linkType,
        targetId: linkTargetId.trim(),
        description: linkDescription.trim() || null,
      },
      {
        onSuccess: () => {
          setLinkType("Document");
          setLinkTargetId("");
          setLinkDescription("");
          setShowAddLink(false);
        },
        onError: (e) => alert(e.message),
      }
    );
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("suppliers.contractLinksSection")}
        </h3>
        <button
          onClick={() => setShowAddLink(!showAddLink)}
          className="inline-flex items-center gap-1 rounded-lg border border-orange-300 px-3 py-1.5 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={showAddLink ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"}
            />
          </svg>
          {showAddLink ? t("common.cancel") : t("suppliers.addLink")}
        </button>
      </div>

      {showAddLink && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("suppliers.linkType")}
              </label>
              <select
                value={linkType}
                onChange={(e) =>
                  setLinkType(
                    e.target.value as "Document" | "Invoice" | "Event"
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
              >
                <option value="Document">Document</option>
                <option value="Invoice">Invoice</option>
                <option value="Event">Event</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("suppliers.linkTargetId")} *
              </label>
              <input
                type="text"
                value={linkTargetId}
                onChange={(e) => setLinkTargetId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder={t("suppliers.linkTargetId")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("suppliers.linkDescription")}
              </label>
              <input
                type="text"
                value={linkDescription}
                onChange={(e) => setLinkDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder={t("suppliers.linkDescription")}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleAdd}
              disabled={!linkTargetId.trim() || addLink.isPending}
              className="rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {addLink.isPending ? t("common.loading") : t("suppliers.addLink")}
            </button>
          </div>
        </div>
      )}

      {contractLinks.length === 0 && !showAddLink ? (
        <p className="text-gray-500">{t("suppliers.noLinks")}</p>
      ) : contractLinks.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-sm font-medium text-gray-500">
                  {t("suppliers.linkType")}
                </th>
                <th className="pb-3 text-sm font-medium text-gray-500">
                  {t("suppliers.linkDescription")}
                </th>
                <th className="pb-3 text-sm font-medium text-gray-500">
                  {t("suppliers.linkCreated")}
                </th>
                <th className="pb-3 text-right text-sm font-medium text-gray-500">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contractLinks.map((link) => {
                const removing =
                  removeLink.isPending && removeLink.variables === link.id;
                return (
                  <tr key={link.id}>
                    <td className="py-3 text-gray-900">{link.linkType}</td>
                    <td className="py-3 text-gray-600">
                      {link.description ?? "–"}
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(link.createdAt).toLocaleDateString("de-CH", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() =>
                          removeLink.mutate(link.id, {
                            onError: (e) => alert(e.message),
                          })
                        }
                        disabled={removing}
                        className="text-sm text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
                      >
                        {removing ? "..." : t("suppliers.removeLink")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

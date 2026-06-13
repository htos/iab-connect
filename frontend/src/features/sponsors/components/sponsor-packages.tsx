"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { useSponsorDetailMutations } from "../hooks/use-sponsor-detail-mutations";
import type { PackageDto } from "../types/sponsor.types";

interface SponsorPackagesProps {
  packages: PackageDto[];
  addPackage: ReturnType<typeof useSponsorDetailMutations>["addPackage"];
  removePackage: ReturnType<typeof useSponsorDetailMutations>["removePackage"];
}

// Packages section of the detail page (E22-S3). Local add-form state stays here;
// the add/remove mutations + cache update live in `useSponsorDetailMutations`.
// Markup + empty state (`sponsors.noPackages`) preserved from the god-page.
export function SponsorPackages({
  packages,
  addPackage,
  removePackage,
}: SponsorPackagesProps) {
  const t = useTranslations();
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgDescription, setPkgDescription] = useState("");
  const [pkgAmount, setPkgAmount] = useState("");
  const [pkgCurrency, setPkgCurrency] = useState("CHF");

  const handleAdd = () => {
    if (!pkgName.trim()) return;
    addPackage.mutate(
      {
        name: pkgName.trim(),
        description: pkgDescription.trim() || null,
        amount: pkgAmount ? parseFloat(pkgAmount) : null,
        currency: pkgCurrency || null,
      },
      {
        onSuccess: () => {
          setPkgName("");
          setPkgDescription("");
          setPkgAmount("");
          setPkgCurrency("CHF");
          setShowAddPackage(false);
        },
        onError: (e) => alert(e.message),
      }
    );
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("sponsors.packagesSection")}
        </h3>
        <button
          onClick={() => setShowAddPackage(!showAddPackage)}
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
              d={showAddPackage ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"}
            />
          </svg>
          {showAddPackage ? t("common.cancel") : t("sponsors.addPackage")}
        </button>
      </div>

      {showAddPackage && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("sponsors.packageName")} *
              </label>
              <input
                type="text"
                value={pkgName}
                onChange={(e) => setPkgName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder={t("sponsors.packageName")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("sponsors.packageDescription")}
              </label>
              <input
                type="text"
                value={pkgDescription}
                onChange={(e) => setPkgDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder={t("sponsors.packageDescription")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("sponsors.packageAmount")}
              </label>
              <input
                type="number"
                step="0.01"
                value={pkgAmount}
                onChange={(e) => setPkgAmount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("sponsors.packageCurrency")}
              </label>
              <select
                value={pkgCurrency}
                onChange={(e) => setPkgCurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
              >
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleAdd}
              disabled={!pkgName.trim() || addPackage.isPending}
              className="rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {addPackage.isPending
                ? t("common.loading")
                : t("sponsors.addPackage")}
            </button>
          </div>
        </div>
      )}

      {packages.length === 0 && !showAddPackage ? (
        <p className="text-gray-500">{t("sponsors.noPackages")}</p>
      ) : packages.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-sm font-medium text-gray-500">
                  {t("sponsors.packageName")}
                </th>
                <th className="pb-3 text-sm font-medium text-gray-500">
                  {t("sponsors.packageDescription")}
                </th>
                <th className="pb-3 text-right text-sm font-medium text-gray-500">
                  {t("sponsors.packageAmount")}
                </th>
                <th className="pb-3 text-right text-sm font-medium text-gray-500">
                  {t("sponsors.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {packages.map((pkg) => {
                const removing =
                  removePackage.isPending && removePackage.variables === pkg.id;
                return (
                  <tr key={pkg.id}>
                    <td className="py-3 text-gray-900">{pkg.name}</td>
                    <td className="py-3 text-gray-600">
                      {pkg.description ?? "–"}
                    </td>
                    <td className="py-3 text-right text-gray-900">
                      {pkg.amount != null
                        ? `${pkg.amount.toLocaleString("de-CH", {
                            minimumFractionDigits: 2,
                          })} ${pkg.currency ?? ""}`
                        : "–"}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() =>
                          removePackage.mutate(pkg.id, {
                            onError: (e) => alert(e.message),
                          })
                        }
                        disabled={removing}
                        className="text-sm text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
                      >
                        {removing ? "..." : t("sponsors.removePackage")}
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

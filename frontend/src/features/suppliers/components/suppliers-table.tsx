import Link from "next/link";
import { useTranslations } from "next-intl";
import { SupplierStatusBadge } from "./supplier-status-badge";
import type { SupplierListDto } from "../types/supplier.types";

interface SuppliersTableProps {
  suppliers: SupplierListDto[];
  onDelete: (target: { id: string; name: string }) => void;
}

export function SuppliersTable({ suppliers, onDelete }: SuppliersTableProps) {
  const t = useTranslations();
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t("suppliers.companyName")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t("suppliers.contactPerson")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t("suppliers.category")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t("suppliers.statusLabel")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                {t("suppliers.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/suppliers/${supplier.id}`}
                    className="font-medium text-orange-600 hover:text-orange-700"
                  >
                    {supplier.companyName}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                  {supplier.contactPerson ?? "-"}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {supplier.category ?? "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SupplierStatusBadge status={supplier.status} />
                </td>
                <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                  <Link
                    href={`/suppliers/${supplier.id}/edit`}
                    className="mr-3 text-orange-600 hover:text-orange-700"
                  >
                    {t("common.edit")}
                  </Link>
                  <button
                    onClick={() =>
                      onDelete({ id: supplier.id, name: supplier.companyName })
                    }
                    className="text-red-600 hover:text-red-700"
                  >
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

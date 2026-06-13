import Link from "next/link";
import { useTranslations } from "next-intl";
import { SponsorStatusBadge } from "./sponsor-status-badge";
import { SponsorTierBadge } from "./sponsor-tier-badge";
import type { SponsorListDto } from "../types/sponsor.types";

interface SponsorsTableProps {
  sponsors: SponsorListDto[];
  // Admin-only delete: the LIST is visible to Vorstand || Admin, but the delete
  // trigger renders only for Admin (the Suppliers table did not need this — that
  // whole page was admin-only).
  isAdmin: boolean;
  onDelete: (target: { id: string; name: string }) => void;
}

export function SponsorsTable({
  sponsors,
  isAdmin,
  onDelete,
}: SponsorsTableProps) {
  const t = useTranslations();
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t("sponsors.companyName")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t("sponsors.contactPerson")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t("sponsors.tier")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t("sponsors.statusLabel")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t("sponsors.packages")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                {t("sponsors.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sponsors.map((sponsor) => (
              <tr key={sponsor.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/sponsors/${sponsor.id}`}
                    className="font-medium text-orange-600 hover:text-orange-700"
                  >
                    {sponsor.companyName}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                  {sponsor.contactPerson ?? "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SponsorTierBadge tier={sponsor.tier} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SponsorStatusBadge status={sponsor.status} />
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {sponsor.packageCount}
                </td>
                <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                  <Link
                    href={`/sponsors/${sponsor.id}/edit`}
                    className="mr-3 text-orange-600 hover:text-orange-700"
                  >
                    {t("common.edit")}
                  </Link>
                  {isAdmin && (
                    <button
                      onClick={() =>
                        onDelete({ id: sponsor.id, name: sponsor.companyName })
                      }
                      className="text-red-600 hover:text-red-700"
                    >
                      {t("common.delete")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

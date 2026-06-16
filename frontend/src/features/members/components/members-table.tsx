import Link from "next/link";
import { useTranslations } from "next-intl";
import { MemberStatusBadge } from "./member-status-badge";
import { MemberTypeBadge } from "./member-type-badge";
import type { MemberDto } from "../types/member.types";

interface MembersTableProps {
  members: MemberDto[];
  // Admin-only: undefined hides the per-row delete trigger.
  onDelete?: (target: { id: string; name: string }) => void;
}

// Members table. Markup preserved verbatim from the god-page; the inline
// type/status colour spans are replaced by the feature-local badges (S2-DEC-2).
export function MembersTable({ members, onDelete }: MembersTableProps) {
  const t = useTranslations();
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("members.table.name")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("members.table.email")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("members.table.type")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("members.table.status")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("members.table.memberSince")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("members.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
                      <span className="font-medium text-orange-600">
                        {member.firstName[0]}
                        {member.lastName[0]}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {member.firstName} {member.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{member.city}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <a
                    href={`mailto:${member.email}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {member.email}
                  </a>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <MemberTypeBadge type={member.membershipType} size="sm" />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <MemberStatusBadge status={member.status} size="sm" />
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {new Date(member.memberSince).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/members/${member.id}`}
                      className="text-blue-600 hover:text-blue-900"
                      title={t("common.details")}
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </Link>
                    <Link
                      href={`/members/${member.id}/edit`}
                      className="text-orange-600 hover:text-orange-900"
                      title={t("common.edit")}
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </Link>
                    {onDelete && (
                      <button
                        onClick={() =>
                          onDelete({
                            id: member.id,
                            name: `${member.firstName} ${member.lastName}`,
                          })
                        }
                        className="text-red-600 hover:text-red-900"
                        title={t("common.delete")}
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Retention Policy API client
 * REQ-057: Datenaufbewahrung & Archivierung
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface RetentionPolicyDto {
  id: string;
  dataCategory: string;
  displayName: string;
  retentionMonths: number;
  action: string;
  legalBasis: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpdateRetentionPolicyRequest {
  displayName: string;
  retentionMonths: number;
  action: string;
  legalBasis: string | null;
  isActive: boolean;
}

/**
 * Get all retention policies
 */
export async function getRetentionPolicies(
  accessToken: string
): Promise<RetentionPolicyDto[]> {
  const response = await fetch(`${API_BASE}/api/v1/admin/retention`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch retention policies");
  }

  return response.json();
}

/**
 * Update a retention policy
 */
export async function updateRetentionPolicy(
  accessToken: string,
  id: string,
  data: UpdateRetentionPolicyRequest
): Promise<RetentionPolicyDto> {
  const response = await fetch(
    `${API_BASE}/api/v1/admin/retention/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to update retention policy");
  }

  return response.json();
}

/**
 * Manually trigger retention enforcement
 */
export async function enforceRetention(
  accessToken: string
): Promise<{ processedRecords: number }> {
  const response = await fetch(`${API_BASE}/api/v1/admin/retention/enforce`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to enforce retention policies");
  }

  return response.json();
}

/**
 * Get action color classes for retention action badges
 */
export function getActionColor(action: string): string {
  switch (action) {
    case "Anonymize":
      return "bg-yellow-100 text-yellow-800";
    case "Archive":
      return "bg-blue-100 text-blue-800";
    case "Delete":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Get category icon name for display
 */
export function getCategoryIcon(category: string): string {
  switch (category) {
    case "audit_logs":
      return "shield";
    case "member_data":
      return "users";
    case "finance_data":
      return "banknotes";
    case "documents":
      return "document";
    case "backups":
      return "server";
    case "events":
      return "calendar";
    default:
      return "folder";
  }
}

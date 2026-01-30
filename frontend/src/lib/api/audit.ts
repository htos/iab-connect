/**
 * Audit Log API client
 * REQ-011: Audit Log (Sicherheits- & Datenänderungen)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: string;
  category: string;
  severity: string;
  userId: string | null;
  userName: string | null;
  ipAddress: string | null;
  entityType: string | null;
  entityId: string | null;
  action: string;
  details: string | null;
  success: boolean;
  errorMessage: string | null;
}

export interface AuditEventListResponse {
  items: AuditEvent[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditCategory {
  value: string;
  label: string;
}

export interface AuditEventType {
  value: string;
  label: string;
  category: string;
}

export interface AuditFilterOptions {
  fromDate?: string;
  toDate?: string;
  eventType?: string;
  category?: string;
  severity?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  success?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Get paginated list of audit events
 */
export async function getAuditEvents(
  accessToken: string,
  options?: AuditFilterOptions
): Promise<AuditEventListResponse> {
  const params = new URLSearchParams();

  if (options?.fromDate) params.append("fromDate", options.fromDate);
  if (options?.toDate) params.append("toDate", options.toDate);
  if (options?.eventType) params.append("eventType", options.eventType);
  if (options?.category) params.append("category", options.category);
  if (options?.severity) params.append("severity", options.severity);
  if (options?.userId) params.append("userId", options.userId);
  if (options?.entityType) params.append("entityType", options.entityType);
  if (options?.entityId) params.append("entityId", options.entityId);
  if (options?.success !== undefined) params.append("success", String(options.success));
  if (options?.search) params.append("search", options.search);
  if (options?.page) params.append("page", String(options.page));
  if (options?.pageSize) params.append("pageSize", String(options.pageSize));

  const response = await fetch(`${API_BASE}/api/v1/audit?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch audit events");
  }

  return response.json();
}

/**
 * Export audit events as CSV
 */
export async function exportAuditEvents(
  accessToken: string,
  options?: AuditFilterOptions
): Promise<Blob> {
  const params = new URLSearchParams();

  if (options?.fromDate) params.append("fromDate", options.fromDate);
  if (options?.toDate) params.append("toDate", options.toDate);
  if (options?.eventType) params.append("eventType", options.eventType);
  if (options?.category) params.append("category", options.category);
  if (options?.severity) params.append("severity", options.severity);
  if (options?.userId) params.append("userId", options.userId);
  if (options?.entityType) params.append("entityType", options.entityType);
  if (options?.success !== undefined) params.append("success", String(options.success));

  const response = await fetch(`${API_BASE}/api/v1/audit/export?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to export audit events");
  }

  return response.blob();
}

/**
 * Get audit history for an entity
 */
export async function getEntityAuditHistory(
  accessToken: string,
  entityType: string,
  entityId: string
): Promise<AuditEvent[]> {
  const response = await fetch(
    `${API_BASE}/api/v1/audit/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch entity audit history");
  }

  return response.json();
}

/**
 * Get audit history for a user
 */
export async function getUserAuditHistory(
  accessToken: string,
  userId: string,
  limit?: number
): Promise<AuditEvent[]> {
  const params = new URLSearchParams();
  if (limit) params.append("limit", String(limit));

  const response = await fetch(
    `${API_BASE}/api/v1/audit/user/${encodeURIComponent(userId)}?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch user audit history");
  }

  return response.json();
}

/**
 * Get available audit categories
 */
export async function getAuditCategories(
  accessToken: string
): Promise<AuditCategory[]> {
  const response = await fetch(`${API_BASE}/api/v1/audit/categories`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch audit categories");
  }

  return response.json();
}

/**
 * Get available audit event types
 */
export async function getAuditEventTypes(
  accessToken: string
): Promise<AuditEventType[]> {
  const response = await fetch(`${API_BASE}/api/v1/audit/event-types`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch audit event types");
  }

  return response.json();
}

/**
 * Get severity badge color
 */
export function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "warning":
      return "bg-yellow-100 text-yellow-800";
    case "info":
    default:
      return "bg-blue-100 text-blue-800";
  }
}

/**
 * Get category badge color
 */
export function getCategoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case "authentication":
      return "bg-purple-100 text-purple-800";
    case "usermanagement":
      return "bg-green-100 text-green-800";
    case "membermanagement":
      return "bg-indigo-100 text-indigo-800";
    case "dataaccess":
      return "bg-cyan-100 text-cyan-800";
    case "system":
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Format date for display
 */
export function formatAuditDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

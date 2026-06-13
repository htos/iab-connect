// Dashboard feature API — encapsulates the KPI endpoint URL (E21-S1 rule 5: no raw
// `/api/v1/...` strings in components). Uses the useApiClient() contract ({ data,
// error, status }, never throws). Builders + keys ONLY — the hook owns the call (A103).
import type { useApiClient } from "@/lib/auth";
import type { DashboardOverview } from "../types/dashboard.types";

type DashboardApiClient = ReturnType<typeof useApiClient>;

export const DASHBOARD_OVERVIEW_URL = "/api/v1/reports/dashboard";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  overview: () => ["dashboard", "overview"] as const,
};

export function fetchDashboardOverview(api: DashboardApiClient) {
  return api.get<DashboardOverview>(DASHBOARD_OVERVIEW_URL);
}

// Health resource types (E27-S4). Re-exported from the WRAPped transport
// (`@/lib/api/health` — already exists, hits server-root `/health*`).
export type {
  HealthEntry,
  HealthDetailResponse,
  HealthReadyResponse,
} from "@/lib/api/health";

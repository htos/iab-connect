const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface HealthEntry {
  name: string;
  status: string;
  description: string | null;
  duration: number;
  exception: string | null;
}

export interface HealthDetailResponse {
  status: string;
  totalDuration: number;
  entries: HealthEntry[];
}

export interface HealthReadyResponse {
  status: string;
  checks: { name: string; status: string; description: string | null }[];
}

export async function getHealthBasic(): Promise<{ healthy: boolean }> {
  const res = await fetch(`${API_BASE}/health`);
  return { healthy: res.ok };
}

export async function getHealthReady(): Promise<HealthReadyResponse> {
  const res = await fetch(`${API_BASE}/health/ready`);
  return res.json();
}

export async function getHealthDetail(
  accessToken: string
): Promise<HealthDetailResponse> {
  const res = await fetch(`${API_BASE}/health/detail`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "Healthy":
      return "text-green-700 bg-green-100";
    case "Degraded":
      return "text-yellow-700 bg-yellow-100";
    case "Unhealthy":
      return "text-red-700 bg-red-100";
    default:
      return "text-gray-700 bg-gray-100";
  }
}

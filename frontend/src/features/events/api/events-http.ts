/**
 * Events slice HTTP base (E31-S1, DEC-4 = each-owner-its-own-copy). Relocated
 * verbatim off the retired `the legacy HTTP base` (only the `apiGet`/`apiPost`
 * surface the event transport uses). Keeps the `ApiResult` shape incl.
 * `errorBody`/`status` that `VolunteerSelfSignupSection` depends on (A99) — this
 * is why the self-signup flow stays on this service, not `useApiClient`.
 *
 * Note: API_BASE_URL should NOT include /api/v1 in the env var — we add it here.
 */

import type { ApiResult } from "@/types/api-result";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const API_BASE_URL = `${API_BASE}/api/v1`;

async function getAuthToken(): Promise<string | null> {
  // Import dynamically to avoid issues with SSR
  if (typeof window === "undefined") return null;

  try {
    const { getSession } = await import("next-auth/react");
    const session = await getSession();
    return (session as { accessToken?: string } | null)?.accessToken || null;
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  requireAuth: boolean = true
): Promise<ApiResult<T>> {
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (requireAuth) {
      const token = await getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const url = endpoint.startsWith("http")
      ? endpoint
      : `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        data: undefined as unknown as T,
        error:
          errorData.message ||
          errorData.title ||
          `HTTP ${response.status}: ${response.statusText}`,
        errorBody: errorData,
        status: response.status,
      };
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {
        success: true,
        data: undefined as unknown as T,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      data: undefined as unknown as T,
      error:
        error instanceof Error
          ? error.message
          : "Ein unbekannter Fehler ist aufgetreten.",
    };
  }
}

export async function apiGet<T>(
  endpoint: string,
  requireAuth: boolean = true
): Promise<ApiResult<T>> {
  return request<T>("GET", endpoint, undefined, requireAuth);
}

export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
  requireAuth: boolean = true
): Promise<ApiResult<T>> {
  return request<T>("POST", endpoint, body, requireAuth);
}

/**
 * Generic API client for the IAB Connect backend.
 * Note: API_BASE_URL should NOT include /api/v1 - we add it here for consistency
 * with other API clients in the codebase (lib/api/*.ts)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = `${API_BASE}/api/v1`;

export interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

async function getAuthToken(): Promise<string | null> {
  // Import dynamically to avoid issues with SSR
  if (typeof window === 'undefined') return null;

  try {
    const { getSession } = await import('next-auth/react');
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
      'Content-Type': 'application/json',
    };

    if (requireAuth) {
      const token = await getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

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
        error: errorData.message || errorData.title || `HTTP ${response.status}: ${response.statusText}`,
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
      error: error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.',
    };
  }
}

export async function apiGet<T>(endpoint: string, requireAuth: boolean = true): Promise<ApiResult<T>> {
  return request<T>('GET', endpoint, undefined, requireAuth);
}

export async function apiPost<T>(endpoint: string, body?: unknown, requireAuth: boolean = true): Promise<ApiResult<T>> {
  return request<T>('POST', endpoint, body, requireAuth);
}

export async function apiPut<T>(endpoint: string, body?: unknown, requireAuth: boolean = true): Promise<ApiResult<T>> {
  return request<T>('PUT', endpoint, body, requireAuth);
}

export async function apiDelete<T>(endpoint: string, requireAuth: boolean = true): Promise<ApiResult<T>> {
  return request<T>('DELETE', endpoint, undefined, requireAuth);
}

/**
 * Auth utilities and hooks for IAB Connect
 * REQ-001: Login & Zugriff (Admin und Mitglieder)
 */
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

// Role constants matching Keycloak realm roles
export const ROLES = {
  ADMIN: "admin",
  VORSTAND: "vorstand",
  KASSIER: "kassier",
  AUDITOR: "auditor",
  MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Auth state interface
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  roles: string[];
  accessToken?: string;
  error?: string;
}

// Role check interface
export interface RoleChecks {
  isAdmin: boolean;
  isVorstand: boolean;
  isKassier: boolean;
  isAuditor: boolean;
  isMember: boolean;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (...roles: Role[]) => boolean;
  hasAllRoles: (...roles: Role[]) => boolean;
  canReadFinance: boolean;
  canWriteFinance: boolean;
}

/**
 * Hook to access authentication state and role checks
 */
export function useAuth(): AuthState & RoleChecks {
  const { data: session, status } = useSession();

  const roles = useMemo(() => session?.roles ?? [], [session?.roles]);

  const hasRole = useCallback((role: Role) => roles.includes(role), [roles]);

  const hasAnyRole = useCallback(
    (...checkRoles: Role[]) => checkRoles.some((role) => roles.includes(role)),
    [roles]
  );

  const hasAllRoles = useCallback(
    (...checkRoles: Role[]) => checkRoles.every((role) => roles.includes(role)),
    [roles]
  );

  return {
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    user: session?.user ?? null,
    roles,
    accessToken: session?.accessToken,
    error: session?.error,
    isAdmin: hasRole(ROLES.ADMIN),
    isVorstand: hasRole(ROLES.VORSTAND),
    isKassier: hasRole(ROLES.KASSIER),
    isAuditor: hasRole(ROLES.AUDITOR),
    isMember: hasRole(ROLES.MEMBER),
    hasRole,
    hasAnyRole,
    hasAllRoles,
    canReadFinance: hasAnyRole(ROLES.ADMIN, ROLES.KASSIER, ROLES.AUDITOR),
    canWriteFinance: hasAnyRole(ROLES.ADMIN, ROLES.KASSIER),
  };
}

/**
 * Hook for protected routes - redirects to login if not authenticated
 */
export function useRequireAuth(options?: {
  requiredRole?: Role;
  requiredRoles?: Role[];
  redirectTo?: string;
}) {
  const auth = useAuth();
  const router = useRouter();

  const { requiredRole, requiredRoles, redirectTo = "/login" } = options ?? {};

  // Check if user has required role(s)
  const hasAccess = useMemo(() => {
    if (!auth.isAuthenticated) return false;
    if (requiredRole && !auth.hasRole(requiredRole)) return false;
    if (requiredRoles && !auth.hasAnyRole(...requiredRoles)) return false;
    return true;
  }, [auth, requiredRole, requiredRoles]);

  // Redirect if not authenticated or no access
  useMemo(() => {
    if (!auth.isLoading && !hasAccess) {
      router.push(redirectTo);
    }
  }, [auth.isLoading, hasAccess, router, redirectTo]);

  return {
    ...auth,
    hasAccess,
    isLoading: auth.isLoading,
  };
}

/**
 * Login function - redirects to Keycloak
 */
export async function login(callbackUrl?: string): Promise<void> {
  await signIn("keycloak", { callbackUrl: callbackUrl ?? "/" });
}

/**
 * Logout function - signs out from NextAuth and Keycloak
 */
export async function logout(): Promise<void> {
  // Get the Keycloak logout URL
  const keycloakLogoutUrl = `${process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/iabconnect"}/protocol/openid-connect/logout`;

  // Sign out from NextAuth
  await signOut({
    callbackUrl:
      keycloakLogoutUrl +
      "?redirect_uri=" +
      encodeURIComponent(window.location.origin),
  });
}

/**
 * Fetch wrapper that adds the access token to requests
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<Response> {
  const headers = new Headers(options.headers);

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * API client hook that includes authentication
 */
export function useApiClient() {
  const { accessToken, isAuthenticated } = useAuth();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  const fetchApi = useCallback(
    async <T>(
      endpoint: string,
      options: RequestInit = {}
    ): Promise<{ data: T | null; error: string | null; status: number }> => {
      if (!isAuthenticated || !accessToken) {
        return { data: null, error: "Not authenticated", status: 401 };
      }

      try {
        const response = await fetchWithAuth(
          `${baseUrl}${endpoint}`,
          {
            ...options,
            headers: {
              "Content-Type": "application/json",
              ...options.headers,
            },
          },
          accessToken
        );

        if (!response.ok) {
          const errorText = await response.text();
          return {
            data: null,
            error: errorText || response.statusText,
            status: response.status,
          };
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          return { data, error: null, status: response.status };
        }
        // For non-JSON responses (e.g. blob downloads), return the response itself
        const data = await response.blob();
        return { data: data as T, error: null, status: response.status };
      } catch (error) {
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
          status: 500,
        };
      }
    },
    [accessToken, isAuthenticated, baseUrl]
  );

  const uploadFile = useCallback(
    async <T>(
      endpoint: string,
      formData: FormData
    ): Promise<{ data: T | null; error: string | null; status: number }> => {
      if (!isAuthenticated || !accessToken) {
        return { data: null, error: "Not authenticated", status: 401 };
      }
      try {
        const response = await fetchWithAuth(
          `${baseUrl}${endpoint}`,
          { method: "POST", body: formData },
          accessToken
        );
        if (!response.ok) {
          const errorText = await response.text();
          return {
            data: null,
            error: errorText || response.statusText,
            status: response.status,
          };
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          return { data, error: null, status: response.status };
        }
        return { data: null, error: null, status: response.status };
      } catch (error) {
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
          status: 500,
        };
      }
    },
    [accessToken, isAuthenticated, baseUrl]
  );

  return {
    get: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: "GET" }),
    post: <T>(endpoint: string, body: unknown) =>
      fetchApi<T>(endpoint, { method: "POST", body: JSON.stringify(body) }),
    put: <T>(endpoint: string, body: unknown) =>
      fetchApi<T>(endpoint, { method: "PUT", body: JSON.stringify(body) }),
    delete: <T>(endpoint: string) =>
      fetchApi<T>(endpoint, { method: "DELETE" }),
    upload: <T>(endpoint: string, formData: FormData) =>
      uploadFile<T>(endpoint, formData),
  };
}

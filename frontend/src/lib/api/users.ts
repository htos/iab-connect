/**
 * User management API client
 * REQ-002: Benutzerverwaltung
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  emailVerified: boolean;
  createdAt: string | null;
  roles: string[];
}

export interface UserListResponse {
  users: User[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  sendInvitation?: boolean;
  temporaryPassword?: string;
  roles?: string[];
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
}

export interface Role {
  name: string;
  description: string | null;
}

/**
 * Get paginated list of users
 */
export async function getUsers(
  accessToken: string,
  options?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<UserListResponse> {
  const params = new URLSearchParams();
  if (options?.search) params.set("search", options.search);
  if (options?.page) params.set("page", options.page.toString());
  if (options?.pageSize) params.set("pageSize", options.pageSize.toString());

  const queryString = params.toString();
  const url = `${API_BASE}/api/v1/users${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status}`);
  }

  return response.json();
}

/**
 * Get total user count
 */
export async function getUserCount(accessToken: string): Promise<number> {
  const response = await fetch(`${API_BASE}/api/v1/users/count`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get user count: ${response.status}`);
  }

  return response.json();
}

/**
 * Get user by ID
 */
export async function getUser(
  accessToken: string,
  userId: string
): Promise<User> {
  const response = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("User not found");
    }
    throw new Error(`Failed to fetch user: ${response.status}`);
  }

  return response.json();
}

/**
 * Create a new user
 */
export async function createUser(
  accessToken: string,
  request: CreateUserRequest
): Promise<User> {
  const response = await fetch(`${API_BASE}/api/v1/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error("A user with this email already exists");
    }
    throw new Error(`Failed to create user: ${response.status}`);
  }

  return response.json();
}

/**
 * Update an existing user
 */
export async function updateUser(
  accessToken: string,
  userId: string,
  request: UpdateUserRequest
): Promise<User> {
  const response = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("User not found");
    }
    throw new Error(`Failed to update user: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a user
 */
export async function deleteUser(
  accessToken: string,
  userId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("User not found");
    }
    throw new Error(`Failed to delete user: ${response.status}`);
  }
}

/**
 * Enable or disable a user
 */
export async function setUserEnabled(
  accessToken: string,
  userId: string,
  enabled: boolean
): Promise<User> {
  const response = await fetch(`${API_BASE}/api/v1/users/${userId}/enabled`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("User not found");
    }
    throw new Error(`Failed to update user status: ${response.status}`);
  }

  return response.json();
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(
  accessToken: string,
  userId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/v1/users/${userId}/reset-password`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("User not found");
    }
    throw new Error(`Failed to send password reset: ${response.status}`);
  }
}

/**
 * Get user roles
 */
export async function getUserRoles(
  accessToken: string,
  userId: string
): Promise<string[]> {
  const response = await fetch(`${API_BASE}/api/v1/users/${userId}/roles`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("User not found");
    }
    throw new Error(`Failed to get user roles: ${response.status}`);
  }

  return response.json();
}

/**
 * Update user roles
 */
export async function updateUserRoles(
  accessToken: string,
  userId: string,
  roles: string[]
): Promise<string[]> {
  const response = await fetch(`${API_BASE}/api/v1/users/${userId}/roles`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roles }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("User not found");
    }
    throw new Error(`Failed to update user roles: ${response.status}`);
  }

  return response.json();
}

/**
 * Get all available roles
 */
export async function getAvailableRoles(accessToken: string): Promise<Role[]> {
  const response = await fetch(`${API_BASE}/api/v1/users/roles`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get available roles: ${response.status}`);
  }

  return response.json();
}

/**
 * Get role display name (German)
 */
export function getRoleDisplayName(role: string): string {
  const displayNames: Record<string, string> = {
    admin: "Administrator",
    vorstand: "Vorstand",
    member: "Mitglied",
  };
  return displayNames[role.toLowerCase()] || role;
}

/**
 * Get role color for badges
 */
export function getRoleColor(
  role: string
): "red" | "blue" | "green" | "gray" {
  const colors: Record<string, "red" | "blue" | "green" | "gray"> = {
    admin: "red",
    vorstand: "blue",
    member: "green",
  };
  return colors[role.toLowerCase()] || "gray";
}

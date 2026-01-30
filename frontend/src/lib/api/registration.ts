/**
 * Registration API client
 * For public user registration (no auth required)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
}

export interface ApiError {
  title: string;
  detail: string;
  status: number;
}

/**
 * Register a new user account
 * User will be created but disabled until admin approval
 */
export async function registerUser(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/registration`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || error.title || 'Registration failed');
  }

  return response.json();
}

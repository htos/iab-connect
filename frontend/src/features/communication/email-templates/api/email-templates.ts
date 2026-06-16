// Email-templates transport (E31-S1, DEC-1 = A relocate + `ApiClient` retirement).
// Relocated off the now-retired `email-templates`; the class-based
// `ApiClient` (`api-client`, deleted in E31-S2) is replaced by a
// BYTE-IDENTICAL private `request` helper — same base URL, same
// `Content-Type: application/json` + Bearer header, same throw-the-parsed-error /
// `{}`-for-204 / `response.json()` semantics. `emailTemplatesApi` is owned by THIS
// slice; the automations + email-campaigns forms cross-import it with an explicit
// `eslint-disable` exception (DEC-3 = A).
import type {
  EmailTemplate,
  CreateEmailTemplateRequest,
  UpdateEmailTemplateRequest,
  PreviewTemplateRequest,
  PreviewTemplateResponse,
} from "@/types/email-templates";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)["Authorization"] =
      `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      message: "An unexpected error occurred",
      statusCode: response.status,
    }));
    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const emailTemplatesApi = {
  async getAllTemplates(accessToken?: string): Promise<EmailTemplate[]> {
    return request("/api/v1/email-templates", { method: "GET" }, accessToken);
  },

  async getTemplateById(
    id: number,
    accessToken?: string
  ): Promise<EmailTemplate> {
    return request(
      `/api/v1/email-templates/${id}`,
      { method: "GET" },
      accessToken
    );
  },

  async getTemplatesByCategory(
    category: string,
    accessToken?: string
  ): Promise<EmailTemplate[]> {
    return request(
      `/api/v1/email-templates/category/${category}`,
      { method: "GET" },
      accessToken
    );
  },

  async createTemplate(
    data: CreateEmailTemplateRequest,
    accessToken?: string
  ): Promise<EmailTemplate> {
    return request(
      "/api/v1/email-templates",
      { method: "POST", body: JSON.stringify(data) },
      accessToken
    );
  },

  async updateTemplate(
    id: number,
    data: UpdateEmailTemplateRequest,
    accessToken?: string
  ): Promise<EmailTemplate> {
    return request(
      `/api/v1/email-templates/${id}`,
      { method: "PUT", body: JSON.stringify(data) },
      accessToken
    );
  },

  async deleteTemplate(id: number, accessToken?: string): Promise<void> {
    return request(
      `/api/v1/email-templates/${id}`,
      { method: "DELETE" },
      accessToken
    );
  },

  async previewTemplate(
    id: number,
    data: PreviewTemplateRequest,
    accessToken?: string
  ): Promise<PreviewTemplateResponse> {
    return request(
      `/api/v1/email-templates/${id}/preview`,
      { method: "POST", body: JSON.stringify(data) },
      accessToken
    );
  },

  async deactivateTemplate(
    id: number,
    accessToken?: string
  ): Promise<EmailTemplate> {
    return request(
      `/api/v1/email-templates/${id}/deactivate`,
      { method: "POST", body: JSON.stringify({}) },
      accessToken
    );
  },
};

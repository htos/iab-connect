export interface EmailTemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  isRequired: boolean;
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  category: string;
  description: string;
  version: number;
  isActive: boolean;
  variables: EmailTemplateVariable[];
}

export interface CreateEmailTemplateRequest {
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  category: string;
  description?: string;
  variables?: EmailTemplateVariable[];
}

export interface UpdateEmailTemplateRequest {
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  category: string;
  description?: string;
  variables?: EmailTemplateVariable[];
}

export interface PreviewTemplateRequest {
  variables?: Record<string, string>;
}

export interface PreviewTemplateResponse {
  subject: string;
  htmlContent: string;
}

export const EMAIL_TEMPLATE_CATEGORIES = [
  "Welcome",
  "EventReminder",
  "EventConfirmation",
  "Payment",
  "PaymentReminder",
  "PasswordReset",
  "Newsletter",
  "Notification",
  "Custom"
] as const;

export type EmailTemplateCategory = (typeof EMAIL_TEMPLATE_CATEGORIES)[number];

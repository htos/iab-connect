import { EmailTemplate, CreateEmailTemplateRequest, UpdateEmailTemplateRequest, PreviewTemplateRequest, PreviewTemplateResponse } from '@/types/email-templates';
import { ApiClient } from './api-client';

export const emailTemplatesApi = {
  async getAllTemplates(accessToken?: string): Promise<EmailTemplate[]> {
    const client = new ApiClient(accessToken);
    return client.get('/api/v1/email-templates');
  },

  async getTemplateById(id: number, accessToken?: string): Promise<EmailTemplate> {
    const client = new ApiClient(accessToken);
    return client.get(`/api/v1/email-templates/${id}`);
  },

  async getTemplatesByCategory(category: string, accessToken?: string): Promise<EmailTemplate[]> {
    const client = new ApiClient(accessToken);
    return client.get(`/api/v1/email-templates/category/${category}`);
  },

  async createTemplate(data: CreateEmailTemplateRequest, accessToken?: string): Promise<EmailTemplate> {
    const client = new ApiClient(accessToken);
    return client.post('/api/v1/email-templates', data);
  },

  async updateTemplate(id: number, data: UpdateEmailTemplateRequest, accessToken?: string): Promise<EmailTemplate> {
    const client = new ApiClient(accessToken);
    return client.put(`/api/v1/email-templates/${id}`, data);
  },

  async deleteTemplate(id: number, accessToken?: string): Promise<void> {
    const client = new ApiClient(accessToken);
    return client.delete(`/api/v1/email-templates/${id}`);
  },

  async previewTemplate(id: number, data: PreviewTemplateRequest, accessToken?: string): Promise<PreviewTemplateResponse> {
    const client = new ApiClient(accessToken);
    return client.post(`/api/v1/email-templates/${id}/preview`, data);
  },

  async deactivateTemplate(id: number, accessToken?: string): Promise<EmailTemplate> {
    const client = new ApiClient(accessToken);
    return client.post(`/api/v1/email-templates/${id}/deactivate`, {});
  },
};

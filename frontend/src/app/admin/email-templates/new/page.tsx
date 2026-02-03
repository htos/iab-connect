'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { CreateEmailTemplateRequest } from '@/types/email-templates';
import { emailTemplatesApi } from '@/lib/email-templates';
import EmailTemplateForm from '@/components/email-templates/EmailTemplateForm';

export default function NewEmailTemplatePage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const handleSave = async (data: CreateEmailTemplateRequest) => {
    if (!accessToken) return;
    try {
      await emailTemplatesApi.createTemplate(data, accessToken);
      router.push('/admin/email-templates');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Neue E-Mail Vorlage</h1>
      <EmailTemplateForm onSave={handleSave} />
    </div>
  );
}

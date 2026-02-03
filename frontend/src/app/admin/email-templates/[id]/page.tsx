'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { EmailTemplate, UpdateEmailTemplateRequest } from '@/types/email-templates';
import { emailTemplatesApi } from '@/lib/email-templates';
import EmailTemplateForm from '@/components/email-templates/EmailTemplateForm';

export default function EditEmailTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { accessToken } = useAuth();
  const id = Number(params.id);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id && accessToken) loadTemplate();
  }, [id, accessToken]);

  const loadTemplate = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const data = await emailTemplatesApi.getTemplateById(id, accessToken);
      setTemplate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: UpdateEmailTemplateRequest) => {
    if (!accessToken) return;
    try {
      await emailTemplatesApi.updateTemplate(id, data, accessToken);
      router.push('/admin/email-templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    }
  };

  if (loading) return <p>Lädt...</p>;
  if (error) return <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>;
  if (!template) return <p>Vorlage nicht gefunden</p>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Vorlage bearbeiten</h1>
      <EmailTemplateForm template={template} onSave={handleSave} />
    </div>
  );
}

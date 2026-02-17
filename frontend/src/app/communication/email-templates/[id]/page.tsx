'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { EmailTemplate, UpdateEmailTemplateRequest } from '@/types/email-templates';
import { emailTemplatesApi } from '@/lib/email-templates';
import EmailTemplateForm from '@/components/email-templates/EmailTemplateForm';

export default function EditEmailTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { accessToken, isLoading: authLoading, isAuthenticated, isAdmin, isVorstand } = useAuth();
  const t = useTranslations('emailTemplates');
  const tCommon = useTranslations('common');
  const id = Number(params.id);

  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadTemplate = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const data = await emailTemplatesApi.getTemplateById(id, accessToken);
      setTemplate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [id, accessToken, t]);

  useEffect(() => {
    if (id && accessToken) loadTemplate();
  }, [id, accessToken, loadTemplate]);

  const handleSave = async (data: UpdateEmailTemplateRequest) => {
    if (!accessToken) return;
    try {
      setSaving(true);
      setError(null);
      await emailTemplatesApi.updateTemplate(id, data, accessToken);
      setSuccess(t('form.saveSuccess'));
      setTimeout(() => {
        router.push('/communication/email-templates');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('form.saveError'));
    } finally {
      setSaving(false);
    }
  };

  // Loading spinner
  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{tCommon('loading')}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || (!isAdmin && !isVorstand)) {
    return null;
  }

  // Template not found
  if (!template && !loading && !error) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/communication/email-templates"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('backToTemplates')}
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700">{t('templateNotFound')}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link
          href="/communication/email-templates"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('backToTemplates')}
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t('editTitle')}</h1>
          <p className="text-gray-600 mt-1">{t('editSubtitle')}</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Form content wrapped in card */}
        {template && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <EmailTemplateForm template={template} onSave={handleSave} isSaving={saving} />
          </div>
        )}
      </div>
    </main>
  );
}

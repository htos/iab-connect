'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { CreateEmailTemplateRequest } from '@/types/email-templates';
import { emailTemplatesApi } from '@/lib/email-templates';
import EmailTemplateForm from '@/components/email-templates/EmailTemplateForm';

export default function NewEmailTemplatePage() {
  const router = useRouter();
  const { accessToken, isLoading: authLoading, isAuthenticated, isAdmin, isVorstand } = useAuth();
  const t = useTranslations('emailTemplates');
  const tCommon = useTranslations('common');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async (data: CreateEmailTemplateRequest) => {
    if (!accessToken) return;
    try {
      setSaving(true);
      setError(null);
      await emailTemplatesApi.createTemplate(data, accessToken);
      setSuccess(t('form.createSuccess'));
      setTimeout(() => {
        router.push('/communication/email-templates');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('form.createError'));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t('newTitle')}</h1>
          <p className="text-gray-600 mt-1">{t('newSubtitle')}</p>
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
        <div className="bg-white rounded-xl shadow-sm p-6">
          <EmailTemplateForm onSave={handleSave} isSaving={saving} />
        </div>
      </div>
    </main>
  );
}

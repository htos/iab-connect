'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';
import { EmailTemplate } from '@/types/email-templates';
import { emailTemplatesApi } from '@/lib/email-templates';

export default function EmailTemplatesPage() {
  const t = useTranslations('emailTemplates');
  const tCommon = useTranslations('common');
  const { accessToken } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadTemplates = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const data = await emailTemplatesApi.getAllTemplates(accessToken);
      setTemplates(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    if (!accessToken) return;
    loadTemplates();
  }, [accessToken, loadTemplates]);

  const handleDelete = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;
    if (!accessToken) return;
    try {
      await emailTemplatesApi.deleteTemplate(id, accessToken);
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deleteError'));
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            <span className="ml-3 text-gray-600">{tCommon('loading')}</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-600 mt-1">{t('subtitle')}</p>
          </div>
          <Link
            href="/communication/email-templates/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('createTemplate')}
          </Link>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Templates list */}
        <div className="grid gap-4">
          {filteredTemplates.map(template => (
            <div key={template.id} className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                  <p className="text-gray-600 text-sm mt-1">{template.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {template.category}
                    </span>
                    {!template.isActive && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500 text-white">
                        {t('inactive')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/communication/email-templates/${template.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {tCommon('edit')}
                  </Link>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {tCommon('delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {filteredTemplates.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">{t('noTemplates')}</h3>
            <p className="mt-2 text-gray-500">{searchTerm ? t('noSearchResults') : t('noTemplatesDescription')}</p>
            {!searchTerm && (
              <Link
                href="/communication/email-templates/new"
                className="inline-flex items-center gap-2 mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('createFirstTemplate')}
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

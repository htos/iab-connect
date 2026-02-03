'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { EmailTemplate } from '@/types/email-templates';
import { emailTemplatesApi } from '@/lib/email-templates';

export default function EmailTemplatesPage() {
  const { accessToken } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    loadTemplates();
  }, [accessToken]);

  const loadTemplates = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const data = await emailTemplatesApi.getAllTemplates(accessToken);
      setTemplates(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Möchten Sie diese Vorlage wirklich löschen?')) return;
    if (!accessToken) return;
    try {
      await emailTemplatesApi.deleteTemplate(id, accessToken);
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">E-Mail Vorlagen</h1>
        <Link
          href="/admin/email-templates/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Neue Vorlage
        </Link>
      </div>

      <input
        type="text"
        placeholder="Vorlagen durchsuchen..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-4 py-2 border rounded mb-6"
      />

      {error && <div className="p-4 bg-red-100 text-red-700 rounded mb-4">{error}</div>}
      {loading && <p>Lädt...</p>}

      <div className="grid gap-4">
        {filteredTemplates.map(template => (
          <div key={template.id} className="border rounded p-4 hover:shadow-md">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{template.name}</h3>
                <p className="text-gray-600 text-sm">{template.description}</p>
                <div className="flex gap-2 mt-2">
                  <span className="inline-block px-2 py-1 bg-gray-200 rounded text-xs">
                    {template.category}
                  </span>
                  {!template.isActive && (
                    <span className="inline-block px-2 py-1 bg-gray-400 rounded text-xs text-white">
                      Inaktiv
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/email-templates/${template.id}`}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  Bearbeiten
                </Link>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredTemplates.length === 0 && (
        <p className="text-center text-gray-500 py-8">Keine Vorlagen gefunden</p>
      )}
    </div>
  );
}

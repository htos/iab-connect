'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EmailTemplate, EMAIL_TEMPLATE_CATEGORIES, EmailTemplateVariable } from '@/types/email-templates';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

interface EmailTemplateFormProps {
  template?: EmailTemplate;
  onSave: (data: any) => Promise<void>;
  isSaving?: boolean;
}

export default function EmailTemplateForm({ template, onSave, isSaving = false }: EmailTemplateFormProps) {
  const t = useTranslations('emailTemplates.form');
  const tCommon = useTranslations('common');

  const [formData, setFormData] = useState({
    name: template?.name || '',
    subject: template?.subject || '',
    category: template?.category || 'Custom',
    description: template?.description || '',
    htmlContent: template?.htmlContent || '<p>Hallo {{name}},</p>',
    textContent: template?.textContent || 'Hallo {{name}},',
    variables: template?.variables || [] as EmailTemplateVariable[],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newVariable, setNewVariable] = useState({ name: '', description: '', defaultValue: '', isRequired: false });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addVariable = () => {
    if (!newVariable.name.trim()) {
      setError(t('variableNameRequired'));
      return;
    }
    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, newVariable]
    }));
    setNewVariable({ name: '', description: '', defaultValue: '', isRequired: false });
  };

  const removeVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await onSave(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const isFormSaving = saving || isSaving;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('name')} *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder={t('namePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('category')} *</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            {EMAIL_TEMPLATE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('description')}</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          rows={2}
          placeholder={t('descriptionPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('subject')} *</label>
        <input
          type="text"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder={t('subjectPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('htmlContent')} *</label>
        <RichTextEditor
          content={formData.htmlContent}
          onChange={(content) => setFormData(prev => ({ ...prev, htmlContent: content }))}
          placeholder="E-Mail-Inhalt eingeben..."
          minHeight="250px"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('textContent')}</label>
        <textarea
          name="textContent"
          value={formData.textContent}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          rows={6}
        />
      </div>

      <div className="border border-gray-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-4">{t('variables')}</h3>
        <div className="space-y-2 mb-4">
          {formData.variables.map((variable, index) => (
            <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
              <div>
                <p className="font-mono text-gray-900">{`{{${variable.name}}}`}</p>
                <p className="text-sm text-gray-600">{variable.description}</p>
              </div>
              <button
                type="button"
                onClick={() => removeVariable(index)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                {t('remove')}
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
          <input
            type="text"
            value={newVariable.name}
            onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
            placeholder={t('variableNamePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <input
            type="text"
            value={newVariable.description}
            onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
            placeholder={t('variableDescriptionPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <input
            type="text"
            value={newVariable.defaultValue}
            onChange={(e) => setNewVariable({ ...newVariable, defaultValue: e.target.value })}
            placeholder={t('variableDefaultPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newVariable.isRequired}
              onChange={(e) => setNewVariable({ ...newVariable, isRequired: e.target.checked })}
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">{t('required')}</span>
          </label>
          <button
            type="button"
            onClick={addVariable}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            {t('addVariable')}
          </button>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isFormSaving}
          className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isFormSaving ? tCommon('saving') : tCommon('save')}
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          {tCommon('cancel')}
        </button>
      </div>
    </form>
  );
}

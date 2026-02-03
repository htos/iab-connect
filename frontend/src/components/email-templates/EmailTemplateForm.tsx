'use client';

import { useState } from 'react';
import { EmailTemplate, EMAIL_TEMPLATE_CATEGORIES, EmailTemplateVariable } from '@/types/email-templates';

interface EmailTemplateFormProps {
  template?: EmailTemplate;
  onSave: (data: any) => Promise<void>;
}

export default function EmailTemplateForm({ template, onSave }: EmailTemplateFormProps) {
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
      setError('Variablenname erforderlich');
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
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded"
            placeholder="z.B. Welcome Email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Kategorie *</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          >
            {EMAIL_TEMPLATE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Beschreibung</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded"
          rows={2}
          placeholder="Beschreibung der Vorlage"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Betreffzeile *</label>
        <input
          type="text"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded"
          placeholder="z.B. Willkommen bei {{organizationName}}"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">HTML Inhalt *</label>
        <textarea
          name="htmlContent"
          value={formData.htmlContent}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded font-mono text-sm"
          rows={10}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Text Inhalt</label>
        <textarea
          name="textContent"
          value={formData.textContent}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded"
          rows={6}
        />
      </div>

      <div className="border rounded p-4">
        <h3 className="font-semibold mb-4">Variablen</h3>
        <div className="space-y-2 mb-4">
          {formData.variables.map((variable, index) => (
            <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded">
              <div>
                <p className="font-mono">{`{{${variable.name}}}`}</p>
                <p className="text-sm text-gray-600">{variable.description}</p>
              </div>
              <button
                type="button"
                onClick={() => removeVariable(index)}
                className="text-red-600 hover:text-red-800"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2 p-3 bg-gray-50 rounded">
          <input
            type="text"
            value={newVariable.name}
            onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
            placeholder="Variablenname (z.B. name, eventTitle)"
            className="w-full px-2 py-1 border rounded text-sm"
          />
          <input
            type="text"
            value={newVariable.description}
            onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
            placeholder="Beschreibung"
            className="w-full px-2 py-1 border rounded text-sm"
          />
          <input
            type="text"
            value={newVariable.defaultValue}
            onChange={(e) => setNewVariable({ ...newVariable, defaultValue: e.target.value })}
            placeholder="Standard-Wert (optional)"
            className="w-full px-2 py-1 border rounded text-sm"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newVariable.isRequired}
              onChange={(e) => setNewVariable({ ...newVariable, isRequired: e.target.checked })}
            />
            <span className="text-sm">Erforderlich</span>
          </label>
          <button
            type="button"
            onClick={addVariable}
            className="w-full px-2 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
          >
            Variable hinzufügen
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2 bg-gray-300 text-black rounded hover:bg-gray-400"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

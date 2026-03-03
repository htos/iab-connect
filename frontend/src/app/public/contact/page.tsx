'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

export default function PublicContactPage() {
  const t = useTranslations('publicContact');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<FormStatus>('idle');

  const subjectOptions = [
    { value: '', label: t('subjectPlaceholder') },
    { value: 'general', label: t('subjectGeneral') },
    { value: 'membership', label: t('subjectMembership') },
    { value: 'events', label: t('subjectEvents') },
    { value: 'sponsoring', label: t('subjectSponsoring') },
    { value: 'other', label: t('subjectOther') },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Honeypot check — silently pretend success
    if (website) {
      setStatus('success');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch(`${baseUrl}/api/v1/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, website }),
      });

      if (!res.ok) throw new Error('Request failed');

      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setWebsite('');
    setStatus('idle');
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 py-2 px-4 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors';

  if (status === 'success') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center rounded-xl bg-green-50 p-12 text-center">
          <svg
            className="mb-4 h-16 w-16 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">{t('successTitle')}</h2>
          <p className="mb-6 text-gray-600">{t('successMessage')}</p>
          <button
            onClick={resetForm}
            className="rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700 transition-colors"
          >
            {t('sendAnother')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-4 text-lg text-gray-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Form — 2 cols */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot — hidden from real users */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                {t('nameLabel')} *
              </label>
              <input
                type="text"
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                {t('emailLabel')} *
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">
                {t('subjectLabel')} *
              </label>
              <select
                id="subject"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputClass}
              >
                {subjectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="message" className="mb-1 block text-sm font-medium text-gray-700">
                {t('messageLabel')} *
              </label>
              <textarea
                id="message"
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('messagePlaceholder')}
                className={inputClass}
              />
            </div>

            {status === 'error' && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {t('errorMessage')}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === 'loading' && (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              {status === 'loading' ? t('sending') : status === 'error' ? t('retry') : t('submit')}
            </button>
          </form>
        </div>

        {/* Contact Info Sidebar — 1 col */}
        <div className="space-y-8">
          <div className="rounded-xl bg-gray-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('contactInfoTitle')}</h3>

            <div className="space-y-4">
              {/* Email */}
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('emailInfoLabel')}</p>
                  <a href="mailto:info@iab-kulturverein.ch" className="text-sm text-orange-600 hover:underline">
                    info@iab-kulturverein.ch
                  </a>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('phoneInfoLabel')}</p>
                  <a href="tel:+41441234567" className="text-sm text-orange-600 hover:underline">
                    +41 44 123 45 67
                  </a>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('addressInfoLabel')}</p>
                  <p className="text-sm text-gray-600">
                    Indischer Kulturverein<br />
                    Musterstrasse 42<br />
                    8000 Zürich<br />
                    {t('country')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Opening hours */}
          <div className="rounded-xl bg-gray-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('hoursTitle')}</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>{t('weekdays')}</span>
                <span>09:00 – 17:00</span>
              </div>
              <div className="flex justify-between">
                <span>{t('saturday')}</span>
                <span>10:00 – 14:00</span>
              </div>
              <div className="flex justify-between">
                <span>{t('sunday')}</span>
                <span>{t('closed')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

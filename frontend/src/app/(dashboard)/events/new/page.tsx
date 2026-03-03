/**
 * REQ-019: Create Event Page
 * Form for creating new events - with i18n support
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';
import {
  EventVisibility,
  EventCategory,
} from '@/lib/services/events';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface CreateEventRequest {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  shortDescription?: string;
  locationAddress?: string;
  locationUrl?: string;
  isAllDay: boolean;
  timeZone: string;
  maxParticipants?: number;
  registrationRequired: boolean;
  registrationDeadline?: string;
  waitlistEnabled: boolean;
  visibility: EventVisibility;
  category: EventCategory;
  tags: string[];
  imageUrl?: string;
  imageAltText?: string;
  organizerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  cost?: number;
  costDescription?: string;
}

export default function NewEventPage() {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { accessToken, isVorstand, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateEventRequest>({
    title: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    shortDescription: '',
    locationAddress: '',
    locationUrl: '',
    isAllDay: false,
    timeZone: 'Europe/Zurich',
    maxParticipants: undefined,
    registrationRequired: false,
    registrationDeadline: '',
    waitlistEnabled: false,
    visibility: EventVisibility.MembersOnly,
    category: EventCategory.General,
    tags: [],
    imageUrl: '',
    imageAltText: '',
    organizerName: '',
    contactEmail: '',
    contactPhone: '',
    cost: undefined,
    costDescription: '',
  });

  const [tagsInput, setTagsInput] = useState('');

  // Redirect if not Vorstand or Admin
  if (!isVorstand && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{t('errors.noPermission')}</h2>
            <p className="mt-2 text-gray-500">{t('errors.noPermissionCreate')}</p>
            <Link
              href="/events"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
            >
              {t('actions.backToEvents')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const inputElement = e.target as HTMLInputElement;

    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: inputElement.checked,
      }));
    } else if (type === 'number') {
      setFormData((prev) => ({
        ...prev,
        [name]: value ? parseFloat(value) : undefined,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    setFormData((prev) => ({
      ...prev,
      tags,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const requestData = {
        ...formData,
        startDate: formData.startDate
          ? new Date(formData.startDate).toISOString()
          : '',
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : '',
        registrationDeadline: formData.registrationDeadline
          ? new Date(formData.registrationDeadline).toISOString()
          : undefined,
      };

      const response = await fetch(`${API_URL}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/events/${data.id}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('errors.createFailed'));
        setLoading(false);
      }
    } catch {
      setError(t('errors.networkError'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('actions.backToEvents')}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{t('createEvent')}</h1>
          <p className="mt-2 text-gray-500">{t('form.createDescription')}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Basic Info */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('form.basicInfo')}</h2>
              <p className="text-sm text-gray-500 mb-6">{t('form.basicInfoDescription')}</p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.title')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    placeholder={t('form.titlePlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="shortDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.shortDescription')}
                  </label>
                  <input
                    type="text"
                    id="shortDescription"
                    name="shortDescription"
                    value={formData.shortDescription || ''}
                    onChange={handleInputChange}
                    placeholder={t('form.shortDescriptionPlaceholder')}
                    maxLength={200}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.description')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    placeholder={t('form.descriptionPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('form.category')}
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors bg-white"
                    >
                      <option value={EventCategory.General}>{t('category.general')}</option>
                      <option value={EventCategory.Cultural}>{t('category.cultural')}</option>
                      <option value={EventCategory.Religious}>{t('category.religious')}</option>
                      <option value={EventCategory.Social}>{t('category.social')}</option>
                      <option value={EventCategory.Sports}>{t('category.sports')}</option>
                      <option value={EventCategory.Educational}>{t('category.educational')}</option>
                      <option value={EventCategory.Charity}>{t('category.charity')}</option>
                      <option value={EventCategory.Meeting}>{t('category.meeting')}</option>
                      <option value={EventCategory.Workshop}>{t('category.workshop')}</option>
                      <option value={EventCategory.Festival}>{t('category.festival')}</option>
                      <option value={EventCategory.Other}>{t('category.other')}</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('form.visibility')}
                    </label>
                    <select
                      id="visibility"
                      name="visibility"
                      value={formData.visibility}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors bg-white"
                    >
                      <option value={EventVisibility.Public}>{t('visibility.public')}</option>
                      <option value={EventVisibility.MembersOnly}>{t('visibility.membersOnly')}</option>
                      <option value={EventVisibility.InviteOnly}>{t('visibility.inviteOnly')}</option>
                      <option value={EventVisibility.Hidden}>{t('visibility.hidden')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.tags')}
                  </label>
                  <input
                    type="text"
                    id="tags"
                    value={tagsInput}
                    onChange={(e) => handleTagsChange(e.target.value)}
                    placeholder={t('form.tagsPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">{t('form.dateTime')}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('form.dateTimeDescription')}</p>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isAllDay"
                    name="isAllDay"
                    checked={formData.isAllDay}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="isAllDay" className="text-sm font-medium text-gray-700">
                    {t('form.allDayEvent')}
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('form.startDate')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={formData.isAllDay ? 'date' : 'datetime-local'}
                      id="startDate"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('form.endDate')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={formData.isAllDay ? 'date' : 'datetime-local'}
                      id="endDate"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">{t('form.locationSection')}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('form.locationDescription')}</p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.location')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    required
                    placeholder={t('form.locationPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="locationAddress" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.address')}
                  </label>
                  <input
                    type="text"
                    id="locationAddress"
                    name="locationAddress"
                    value={formData.locationAddress || ''}
                    onChange={handleInputChange}
                    placeholder={t('form.addressPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="locationUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.locationUrl')}
                  </label>
                  <input
                    type="url"
                    id="locationUrl"
                    name="locationUrl"
                    value={formData.locationUrl || ''}
                    onChange={handleInputChange}
                    placeholder={t('form.locationUrlPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Registration */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">{t('registration.title')}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('registration.description')}</p>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="registrationRequired"
                    name="registrationRequired"
                    checked={formData.registrationRequired}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="registrationRequired" className="text-sm font-medium text-gray-700">
                    {t('registration.required')}
                  </label>
                </div>

                {formData.registrationRequired && (
                  <>
                    <div>
                      <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('registration.maxParticipants')}
                      </label>
                      <input
                        type="number"
                        id="maxParticipants"
                        name="maxParticipants"
                        value={formData.maxParticipants || ''}
                        onChange={handleInputChange}
                        min="1"
                        placeholder={t('registration.maxParticipantsPlaceholder')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label htmlFor="registrationDeadline" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('registration.deadline')}
                      </label>
                      <input
                        type="datetime-local"
                        id="registrationDeadline"
                        name="registrationDeadline"
                        value={formData.registrationDeadline || ''}
                        onChange={handleInputChange}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="waitlistEnabled"
                        name="waitlistEnabled"
                        checked={formData.waitlistEnabled}
                        onChange={handleInputChange}
                        className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <label htmlFor="waitlistEnabled" className="text-sm font-medium text-gray-700">
                        {t('registration.waitlistEnabled')}
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Cost */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">{t('form.costSection')}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('form.costDescription')}</p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.cost')} (CHF)
                  </label>
                  <input
                    type="number"
                    id="cost"
                    name="cost"
                    value={formData.cost || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    placeholder={t('form.costPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="costDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.costDescriptionLabel')}
                  </label>
                  <input
                    type="text"
                    id="costDescription"
                    name="costDescription"
                    value={formData.costDescription || ''}
                    onChange={handleInputChange}
                    placeholder={t('form.costDescriptionPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Contact & Image */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">{t('form.contactSection')}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('form.contactDescription')}</p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="organizerName" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.organizerName')}
                  </label>
                  <input
                    type="text"
                    id="organizerName"
                    name="organizerName"
                    value={formData.organizerName || ''}
                    onChange={handleInputChange}
                    placeholder={t('form.organizerNamePlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('form.contactEmail')}
                    </label>
                    <input
                      type="email"
                      id="contactEmail"
                      name="contactEmail"
                      value={formData.contactEmail || ''}
                      onChange={handleInputChange}
                      placeholder={t('form.contactEmailPlaceholder')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('form.contactPhone')}
                    </label>
                    <input
                      type="tel"
                      id="contactPhone"
                      name="contactPhone"
                      value={formData.contactPhone || ''}
                      onChange={handleInputChange}
                      placeholder={t('form.contactPhonePlaceholder')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.imageUrl')}
                  </label>
                  <input
                    type="url"
                    id="imageUrl"
                    name="imageUrl"
                    value={formData.imageUrl || ''}
                    onChange={handleInputChange}
                    placeholder={t('form.imageUrlPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="imageAltText" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.imageAltText')}
                  </label>
                  <input
                    type="text"
                    id="imageAltText"
                    name="imageAltText"
                    value={formData.imageAltText || ''}
                    onChange={handleInputChange}
                    placeholder={t('form.imageAltTextPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="mt-8 flex items-center justify-end gap-4">
            <Link
              href="/events"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {tCommon('cancel')}
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('actions.creating')}
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('actions.create')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

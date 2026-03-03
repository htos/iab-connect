# Frontend Design Standards

This document defines the design standards for the IAB Connect frontend. All new pages and components **MUST** follow these patterns to ensure consistency.

## Table of Contents

1. [Color Palette](#color-palette)
2. [Page Layout](#page-layout)
3. [Header Pattern](#header-pattern)
4. [Cards & Panels](#cards--panels)
5. [Section Headers](#section-headers)
6. [Form Inputs](#form-inputs)
7. [Buttons](#buttons)
8. [Alerts & Notifications](#alerts--notifications)
9. [Tables](#tables)
10. [List Page Search Fields](#list-page-search-fields)
11. [Navigation Elements](#navigation-elements)
12. [Loading States](#loading-states)
13. [Internationalization (i18n)](#internationalization-i18n)
14. [Responsive Design](#responsive-design)

---

## Color Palette

### Primary Colors

| Color | Tailwind Class | Hex Code | Usage |
|-------|---------------|----------|-------|
| Primary | `orange-600` | `#ea580c` | Primary buttons, links, accents |
| Primary Hover | `orange-700` | `#c2410c` | Hover states for primary elements |
| Primary Light | `orange-100` | `#ffedd5` | Icon backgrounds, subtle highlights |
| Primary Text | `orange-600` | `#ea580c` | Link text, active states |

### Neutral Colors

| Color | Tailwind Class | Hex Code | Usage |
|-------|---------------|----------|-------|
| Background | `gray-50` | `#f9fafb` | Page background |
| Surface | `white` | `#ffffff` | Cards, panels, modals |
| Text Primary | `gray-900` | `#111827` | Headlines, important text |
| Text Secondary | `gray-600` | `#4b5563` | Body text, descriptions |
| Text Muted | `gray-500` | `#6b7280` | Helper text, placeholders |
| Border | `gray-300` | `#d1d5db` | Input borders, dividers |
| Border Light | `gray-200` | `#e5e7eb` | Table dividers, subtle borders |

### Semantic Colors

| Color | Tailwind Class | Hex Code | Usage |
|-------|---------------|----------|-------|
| Success | `green-600` | `#16a34a` | Success messages, positive status |
| Success Light | `green-50` | `#f0fdf4` | Success alert background |
| Error | `red-600` | `#dc2626` | Error messages, danger actions |
| Error Light | `red-50` | `#fef2f2` | Error alert background |
| Warning | `yellow-600` | `#ca8a04` | Warning messages |
| Warning Light | `yellow-50` | `#fefce8` | Warning alert background |

---

## Page Layout

### Standard Page Container

All authenticated pages use this base layout:

```tsx
<main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
  <div className="max-w-7xl mx-auto">
    {/* Page content */}
  </div>
</main>
```

### Container Width Guidelines

| Page Type | Max Width | Use Case |
|-----------|-----------|----------|
| List views | `max-w-7xl mx-auto` | Member lists, event tables, dashboards |
| Forms | `max-w-4xl mx-auto` | Edit pages, create forms, settings |
| Detail views | `max-w-5xl mx-auto` | Member profile, event details |

---

## Header Pattern

### Standard Page Header

Every page should have a header with title, subtitle, and optional action button:

```tsx
<div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
  <div>
    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
    <p className="text-gray-600 mt-1">{subtitle}</p>
  </div>
  <Link
    href="/path/to/create"
    className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
  >
    <PlusIcon className="h-5 w-5" />
    {t("action.create")}
  </Link>
</div>
```

### Header Without Action Button

```tsx
<div className="mb-8">
  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
  <p className="text-gray-600 mt-1">{subtitle}</p>
</div>
```

---

## Cards & Panels

### Standard Card

```tsx
<div className="bg-white rounded-xl shadow-sm p-6">
  {/* Card content */}
</div>
```

### Compact Card

```tsx
<div className="bg-white rounded-xl shadow-sm p-4">
  {/* Compact content */}
</div>
```

### Table Container

```tsx
<div className="bg-white rounded-xl shadow-sm overflow-hidden">
  <table className="min-w-full divide-y divide-gray-200">
    {/* Table content */}
  </table>
</div>
```

### Filter Section

```tsx
<div className="bg-white rounded-xl shadow-sm p-4 mb-6">
  <div className="flex flex-col md:flex-row gap-4">
    {/* Filter inputs */}
  </div>
</div>
```

---

## Section Headers

### Section Header with Icon

Use this pattern for distinct sections within a page:

```tsx
<div className="flex items-center gap-3 mb-4">
  <div className="p-2 bg-orange-100 rounded-lg">
    <IconComponent className="h-5 w-5 text-orange-600" />
  </div>
  <div>
    <h2 className="text-lg font-medium text-gray-900">{title}</h2>
    <p className="text-sm text-gray-500">{description}</p>
  </div>
</div>
```

### Simple Section Header

```tsx
<h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
```

### Subsection Header

```tsx
<h3 className="text-base font-medium text-gray-900 mb-3">{title}</h3>
```

---

## Form Inputs

### Text Input

```tsx
<input
  type="text"
  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
  placeholder={t("placeholder.text")}
/>
```

### Select Input

```tsx
<select className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors bg-white">
  <option value="">{t("select.placeholder")}</option>
  {/* Options */}
</select>
```

### Textarea

```tsx
<textarea
  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors resize-none"
  rows={4}
/>
```

### Checkbox

```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
  />
  <span className="text-sm text-gray-700">{label}</span>
</label>
```

### Form Label

```tsx
<label className="block text-sm font-medium text-gray-700 mb-1">
  {label}
  {required && <span className="text-red-500 ml-1">*</span>}
</label>
```

### Form Error Message

```tsx
<p className="mt-1 text-sm text-red-600">{errorMessage}</p>
```

### Form Field Group

```tsx
<div className="space-y-1">
  <label className="block text-sm font-medium text-gray-700">
    {label}
  </label>
  <input
    type="text"
    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
  />
  {error && <p className="text-sm text-red-600">{error}</p>}
</div>
```

---

## Buttons

### Primary Button

```tsx
<button className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
  {t("action.save")}
</button>
```

### Secondary Button

```tsx
<button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
  {t("action.cancel")}
</button>
```

### Danger Button

```tsx
<button className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors">
  {t("action.delete")}
</button>
```

### Text/Link Button (Danger)

```tsx
<button className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors">
  {t("action.delete")}
</button>
```

### Icon Button

```tsx
<button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
  <IconComponent className="h-5 w-5" />
</button>
```

### Button Group

```tsx
<div className="flex items-center gap-3">
  <button className="...secondary styles...">{t("action.cancel")}</button>
  <button className="...primary styles...">{t("action.save")}</button>
</div>
```

---

## Alerts & Notifications

### Error Alert

```tsx
<div className="bg-red-50 border border-red-200 rounded-xl p-4">
  <div className="flex items-start gap-3">
    <ExclamationCircleIcon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
    <div>
      <h4 className="text-sm font-medium text-red-800">{title}</h4>
      <p className="text-sm text-red-700 mt-1">{message}</p>
    </div>
  </div>
</div>
```

### Success Alert

```tsx
<div className="bg-green-50 border border-green-200 rounded-xl p-4">
  <div className="flex items-start gap-3">
    <CheckCircleIcon className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
    <div>
      <h4 className="text-sm font-medium text-green-800">{title}</h4>
      <p className="text-sm text-green-700 mt-1">{message}</p>
    </div>
  </div>
</div>
```

### Warning Alert

```tsx
<div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
  <div className="flex items-start gap-3">
    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
    <div>
      <h4 className="text-sm font-medium text-yellow-800">{title}</h4>
      <p className="text-sm text-yellow-700 mt-1">{message}</p>
    </div>
  </div>
</div>
```

### Info Alert

```tsx
<div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
  <div className="flex items-start gap-3">
    <InformationCircleIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
    <div>
      <h4 className="text-sm font-medium text-blue-800">{title}</h4>
      <p className="text-sm text-blue-700 mt-1">{message}</p>
    </div>
  </div>
</div>
```

---

## Tables

### Standard Table

```tsx
<div className="bg-white rounded-xl shadow-sm overflow-hidden">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          {header}
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {content}
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Table Cell Variants

```tsx
// Primary text
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">

// Secondary text
<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">

// Actions cell
<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
  <div className="flex items-center justify-end gap-2">
    {/* Action buttons */}
  </div>
</td>
```

### Empty State

```tsx
<tr>
  <td colSpan={columnCount} className="px-6 py-12 text-center">
    <div className="text-gray-500">
      <DocumentIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
      <p className="text-lg font-medium">{t("table.empty.title")}</p>
      <p className="text-sm mt-1">{t("table.empty.description")}</p>
    </div>
  </td>
</tr>
```

---

## List Page Search Fields

**MANDATORY**: Every list/table page MUST include a search field above the data table or card grid to allow users to filter content. This ensures a consistent user experience across all modules.

### Standard Search Pattern

```tsx
const [searchTerm, setSearchTerm] = useState("");

// Client-side filtering (when backend doesn't support search params)
const filteredItems = items.filter((item) => {
  const term = searchTerm.toLowerCase();
  return (
    item.name.toLowerCase().includes(term) ||
    item.email?.toLowerCase().includes(term) ||
    // Add all relevant searchable fields
  );
});
```

### Search Input Placement

The search field is placed between the page header and the data table/cards, alongside any filter dropdowns (e.g., status filter).

```tsx
{/* Filters Row */}
<div className="flex flex-col md:flex-row gap-4 mb-6">
  <div className="flex-1">
    <input
      type="text"
      placeholder={t("module.searchPlaceholder")}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
    />
  </div>
  <select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
  >
    <option value="">{t("module.allStatuses")}</option>
    {/* Status options */}
  </select>
</div>
```

### i18n Key Convention

Every module must provide a `searchPlaceholder` key in its i18n section:

```json
{
  "module": {
    "searchPlaceholder": "Search items..."
  }
}
```

### Requirements

- **All list pages** must have a search input (members, events, sponsors, suppliers, invoices, transactions, payments, email campaigns, etc.)
- Search should filter across **all user-visible text columns** (name, email, phone, category, etc.)
- Use `outline-none transition-colors` on search inputs (same as all other form inputs)
- Use `rounded-lg` with `focus:ring-2 focus:ring-orange-500 focus:border-orange-500`

---

## Navigation Elements

### Back Link

```tsx
<Link
  href="/parent-page"
  className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors mb-6"
>
  <ArrowLeftIcon className="h-4 w-4" />
  <span>{t("action.back")}</span>
</Link>
```

### Breadcrumbs

```tsx
<nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
  <Link href="/dashboard" className="hover:text-gray-700">
    {t("nav.dashboard")}
  </Link>
  <ChevronRightIcon className="h-4 w-4" />
  <Link href="/members" className="hover:text-gray-700">
    {t("nav.members")}
  </Link>
  <ChevronRightIcon className="h-4 w-4" />
  <span className="text-gray-900 font-medium">{currentPage}</span>
</nav>
```

### Tab Navigation

```tsx
<div className="border-b border-gray-200 mb-6">
  <nav className="-mb-px flex gap-6">
    <button
      className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
        isActive
          ? "border-orange-600 text-orange-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {tabLabel}
    </button>
  </nav>
</div>
```

---

## Loading States

### Full Page Loading

```tsx
<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50">
  <div className="text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
    <p className="mt-4 text-gray-600">{t("common.loading")}</p>
  </div>
</div>
```

### Inline Loading Spinner

```tsx
<div className="flex items-center justify-center py-8">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
</div>
```

### Button Loading State

```tsx
<button
  disabled={isLoading}
  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isLoading && (
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
  )}
  {isLoading ? t("common.saving") : t("action.save")}
</button>
```

### Skeleton Loading

```tsx
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>
```

---

## Internationalization (i18n)

### Requirements

- **ALL text MUST use translations** via `useTranslations()` from `next-intl`
- **NO hardcoded text** in components
- Translation files are located in `messages/de.json` and `messages/en.json`

### Usage Pattern

```tsx
import { useTranslations } from "next-intl";

export default function MyComponent() {
  const t = useTranslations("myComponent");

  return (
    <div>
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
      <button>{t("actions.save")}</button>
    </div>
  );
}
```

### Translation File Structure

```json
{
  "myComponent": {
    "title": "Page Title",
    "description": "Page description text",
    "actions": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete"
    }
  }
}
```

### Common Translation Keys

Use consistent keys across components:

- `common.loading` - Loading states
- `common.error` - Generic error
- `common.success` - Success messages
- `action.save` - Save button
- `action.cancel` - Cancel button
- `action.delete` - Delete action
- `action.edit` - Edit action
- `action.create` - Create/Add action
- `action.back` - Back navigation
- `validation.required` - Required field error

---

## Responsive Design

### Breakpoints

Follow Tailwind's default breakpoints:

| Prefix | Min Width | Device |
|--------|-----------|--------|
| (none) | 0px | Mobile |
| `sm:` | 640px | Large phones |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Laptops |
| `xl:` | 1280px | Desktops |
| `2xl:` | 1536px | Large screens |

### Mobile-First Approach

Always design mobile-first, then add responsive modifiers:

```tsx
// ✅ Correct: Mobile-first
<div className="p-4 md:p-8">
<div className="flex flex-col md:flex-row">
<div className="text-sm md:text-base">

// ❌ Incorrect: Desktop-first
<div className="p-8 sm:p-4">
```

### Common Responsive Patterns

```tsx
// Stack on mobile, row on desktop
<div className="flex flex-col md:flex-row md:items-center gap-4">

// Full width on mobile, auto on desktop
<button className="w-full md:w-auto">

// Hide on mobile, show on desktop
<div className="hidden md:block">

// Show on mobile, hide on desktop
<div className="md:hidden">

// Grid responsive columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

---

## Status Badges

### Member Status

```tsx
const statusStyles = {
  Active: "bg-green-100 text-green-800",
  Pending: "bg-yellow-100 text-yellow-800",
  Inactive: "bg-gray-100 text-gray-800",
  Suspended: "bg-red-100 text-red-800",
};

<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}>
  {t(`status.${status.toLowerCase()}`)}
</span>
```

### Generic Badge

```tsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
  {label}
</span>
```

---

## Modals & Dialogs

### Confirmation Dialog

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  {/* Backdrop */}
  <div className="fixed inset-0 bg-black/50" onClick={onClose} />
  
  {/* Dialog */}
  <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
    <h2 className="text-lg font-semibold text-gray-900 mb-2">
      {t("dialog.confirmTitle")}
    </h2>
    <p className="text-gray-600 mb-6">
      {t("dialog.confirmMessage")}
    </p>
    <div className="flex justify-end gap-3">
      <button className="...secondary...">{t("action.cancel")}</button>
      <button className="...danger...">{t("action.confirm")}</button>
    </div>
  </div>
</div>
```

---

## Quick Reference

### Spacing Scale

| Class | Size |
|-------|------|
| `p-1` / `m-1` | 4px |
| `p-2` / `m-2` | 8px |
| `p-3` / `m-3` | 12px |
| `p-4` / `m-4` | 16px |
| `p-6` / `m-6` | 24px |
| `p-8` / `m-8` | 32px |

### Border Radius

| Class | Radius |
|-------|--------|
| `rounded` | 4px |
| `rounded-lg` | 8px |
| `rounded-xl` | 12px |
| `rounded-full` | 9999px |

### Font Sizes

| Class | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Labels, badges |
| `text-sm` | 14px | Body text, buttons |
| `text-base` | 16px | Large body text |
| `text-lg` | 18px | Section headers |
| `text-xl` | 20px | Card titles |
| `text-2xl` | 24px | Page titles (mobile) |
| `text-3xl` | 30px | Page titles (desktop) |

---

## Checklist for New Pages

When creating a new page, ensure:

- [ ] Page uses `min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50` layout
- [ ] Appropriate max-width container (`max-w-7xl` for lists, `max-w-4xl` for forms)
- [ ] Page header with title and subtitle
- [ ] Loading state implemented
- [ ] Error handling with proper alert styles
- [ ] All text uses `useTranslations()`
- [ ] Translations added to both `de.json` and `en.json`
- [ ] Mobile-responsive design tested
- [ ] Primary color is Orange-600 (not blue)
- [ ] Buttons follow standard styles
- [ ] Cards use `rounded-xl shadow-sm` pattern

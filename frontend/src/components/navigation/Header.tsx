"use client";

/**
 * Header Navigation Component
 * Contains: Logo, Hamburger Menu, User Info, Role Badge, Sign Out, Language Switcher
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import { useSidebar } from "./SidebarContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header() {
  const pathname = usePathname();
  const t = useTranslations();
  const { isAuthenticated, isLoading, user, isAdmin, isVorstand } = useAuth();
  const { settings } = useAppSettings();
  const { toggle, isOpen } = useSidebar();

  // Don't show on login or error pages
  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    return null;
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="fixed top-0 right-0 left-0 z-50 h-16 border-b border-gray-200 bg-white shadow-sm">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Button */}
          {isAuthenticated && (
            <button
              onClick={toggle}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 lg:hidden"
              aria-label={t("nav.toggleSidebar")}
            >
              <svg
                className="h-6 w-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          )}

          {/* Desktop Sidebar Toggle */}
          {isAuthenticated && (
            <button
              onClick={toggle}
              className="hidden rounded-lg p-2 transition-colors hover:bg-gray-100 lg:flex"
              aria-label={t("nav.toggleSidebar")}
            >
              <svg
                className="h-5 w-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: settings.logoBackgroundColor }}
            >
              <span
                className="text-sm font-bold"
                style={{ color: settings.logoTextColor }}
              >
                {settings.logoText}
              </span>
            </div>
            <span className="hidden text-lg font-semibold text-gray-900 sm:inline">
              {settings.applicationName}
            </span>
          </Link>
        </div>

        {/* Right: User area */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Language Switcher */}
          <LanguageSwitcher />

          {isLoading ? (
            <div className="h-8 w-24 animate-pulse rounded bg-gray-200"></div>
          ) : isAuthenticated ? (
            <>
              {/* Role badges - hidden on mobile */}
              <div className="hidden items-center gap-2 md:flex">
                {isAdmin && (
                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                    {t("roles.admin")}
                  </span>
                )}
                {isVorstand && !isAdmin && (
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                    {t("roles.board")}
                  </span>
                )}
              </div>

              {/* User info */}
              <div className="hidden text-right sm:block">
                <p className="max-w-37.5 truncate text-sm font-medium text-gray-900">
                  {user?.name || user?.email}
                </p>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                title={t("auth.signOut")}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="hidden sm:inline">{t("auth.signOut")}</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              {t("auth.signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

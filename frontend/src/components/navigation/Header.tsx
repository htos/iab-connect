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
import { useSidebar } from "./SidebarContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header() {
  const pathname = usePathname();
  const t = useTranslations();
  const { isAuthenticated, isLoading, user, isAdmin, isVorstand } = useAuth();
  const { toggle, isOpen } = useSidebar();

  // Don't show on login or error pages
  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    return null;
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm h-16">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Button */}
          {isAuthenticated && (
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
              aria-label={t("nav.toggleSidebar")}
            >
              <svg
                className="w-6 h-6 text-gray-600"
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
              className="hidden lg:flex p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={t("nav.toggleSidebar")}
            >
              <svg
                className="w-5 h-5 text-gray-600"
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
            <div className="h-9 w-9 bg-orange-600 rounded-full flex items-center justify-center">
              <span className="text-sm text-white font-bold">IAB</span>
            </div>
            <span className="text-lg font-semibold text-gray-900 hidden sm:inline">
              IAB Connect
            </span>
          </Link>
        </div>

        {/* Right: User area */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Language Switcher */}
          <LanguageSwitcher />

          {isLoading ? (
            <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div>
          ) : isAuthenticated ? (
            <>
              {/* Role badges - hidden on mobile */}
              <div className="hidden md:flex items-center gap-2">
                {isAdmin && (
                  <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    {t("roles.admin")}
                  </span>
                )}
                {isVorstand && !isAdmin && (
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                    {t("roles.board")}
                  </span>
                )}
              </div>

              {/* User info */}
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                  {user?.name || user?.email}
                </p>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title={t("auth.signOut")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
            >
              {t("auth.signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

/**
 * Sidebar Navigation Component
 * Collapsible sidebar with navigation items based on user roles with submenu support
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, ROLES } from "@/lib/auth";
import { useSidebar } from "./SidebarContext";
import { useState } from "react";

interface NavItem {
  labelKey: string;
  href?: string;
  icon: React.ReactNode;
  requiredRoles?: string[];
  submenu?: NavItem[];
}

// Navigation items with role requirements
const navItems: NavItem[] = [
  {
    labelKey: "nav.dashboard",
    href: "/",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    labelKey: "nav.myProfile",
    href: "/profile",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
    requiredRoles: [ROLES.MEMBER],
  },
  {
    labelKey: "nav.members",
    href: "/members",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
    requiredRoles: [ROLES.VORSTAND, ROLES.ADMIN],
  },
  {
    labelKey: "nav.events",
    href: "/events",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    labelKey: "nav.documents",
    href: "/documents",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    labelKey: "nav.communication",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    requiredRoles: [ROLES.VORSTAND, ROLES.ADMIN],
    submenu: [
      {
        labelKey: "nav.emailCampaigns",
        href: "/email-campaigns",
        icon: <></>,
      },
      {
        labelKey: "nav.emailTemplates",
        href: "/admin/email-templates",
        icon: <></>,
      },
    ],
  },
  {
    labelKey: "nav.finance",
    href: "/finance",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    requiredRoles: [ROLES.VORSTAND, ROLES.ADMIN],
  },
  {
    labelKey: "nav.reports",
    href: "/reports",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    requiredRoles: [ROLES.VORSTAND, ROLES.ADMIN],
  },
  {
    labelKey: "nav.users",
    href: "/users",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
    requiredRoles: [ROLES.ADMIN],
  },
  {
    labelKey: "nav.admin",
    href: "/admin",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    requiredRoles: [ROLES.ADMIN],
  },
];

interface SidebarItemProps {
  item: NavItem;
  isActive: boolean;
  isOpen: boolean;
  onNavigate: () => void;
  t: any;
}

function NavItemWithSubmenu({ item, isActive, isOpen, onNavigate, t }: SidebarItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  if (!item.submenu) {
    return (
      <Link
        href={item.href || "#"}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
          isActive
            ? "bg-orange-100 text-orange-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
        title={!isOpen ? t(item.labelKey) : undefined}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        <span
          className={`font-medium whitespace-nowrap transition-opacity duration-200 ${
            isOpen ? "opacity-100" : "lg:opacity-0 lg:w-0 lg:overflow-hidden"
          }`}
        >
          {t(item.labelKey)}
        </span>
      </Link>
    );
  }

  // Has submenu
  const hasActiveChild = item.submenu.some(
    (sub) => pathname === sub.href || pathname.startsWith(sub.href + "/")
  );

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
          hasActiveChild || isActive
            ? "bg-orange-100 text-orange-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
        title={!isOpen ? t(item.labelKey) : undefined}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        <span
          className={`font-medium whitespace-nowrap transition-opacity duration-200 flex-1 text-left ${
            isOpen ? "opacity-100" : "lg:opacity-0 lg:w-0 lg:overflow-hidden"
          }`}
        >
          {t(item.labelKey)}
        </span>
        {isOpen && (
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        )}
      </button>

      {/* Submenu */}
      {isOpen && isExpanded && (
        <div className="ml-3 mt-1 space-y-1 border-l border-gray-200 pl-3">
          {item.submenu.map((subitem) => {
            const isSubActive = pathname === subitem.href || pathname.startsWith(subitem.href + "/");
            return (
              <Link
                key={subitem.href}
                href={subitem.href || "#"}
                onClick={onNavigate}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isSubActive
                    ? "bg-orange-50 text-orange-600 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {t(subitem.labelKey)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations();
  const { isAuthenticated, isLoading, roles } = useAuth();
  const { isOpen, close } = useSidebar();

  // Don't show on login or error pages
  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    return null;
  }

  // Don't show if not authenticated
  if (!isAuthenticated || isLoading) {
    return null;
  }

  // Filter navigation items based on user roles
  const visibleNavItems = navItems.filter((item) => {
    if (!item.requiredRoles) return true;
    return item.requiredRoles.some((role) => roles.includes(role));
  });

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${
          isOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:w-20 lg:translate-x-0"
        }`}
      >
        <nav className="flex flex-col h-full py-4">
          {/* Navigation Items */}
          <div className="flex-1 px-3 space-y-1 overflow-y-auto">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href && pathname.startsWith(item.href + "/"));

              return (
                <NavItemWithSubmenu
                  key={item.labelKey}
                  item={item}
                  isActive={isActive}
                  isOpen={isOpen}
                  onNavigate={() => {
                    // Close sidebar on mobile after navigation
                    if (window.innerWidth < 1024) {
                      close();
                    }
                  }}
                  t={t}
                />
              );
            })}
          </div>

          {/* Bottom section - App version or additional info */}
          <div
            className={`px-3 py-4 border-t border-gray-200 transition-opacity duration-200 ${
              isOpen ? "opacity-100" : "lg:opacity-0"
            }`}
          >
            <p className="text-xs text-gray-400 text-center">IAB Connect v0.1.0</p>
          </div>
        </nav>
      </aside>
    </>
  );
}

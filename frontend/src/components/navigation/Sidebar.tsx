"use client";

/**
 * Sidebar Navigation Component
 * Collapsible sidebar with navigation items based on user roles with submenu support
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient, ROLES } from "@/lib/auth";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import { useSidebar } from "./SidebarContext";
import { useState, useCallback, useEffect, useRef } from "react";

interface NavItem {
  labelKey: string;
  href?: string;
  icon: React.ReactNode;
  requiredRoles?: string[];
  requiresDoubleEntry?: boolean;
  submenu?: NavItem[];
}

// Navigation items with role requirements
const navItems: NavItem[] = [
  {
    labelKey: "nav.dashboard",
    href: "/",
    icon: (
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
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    labelKey: "nav.myProfile",
    href: "/profile",
    icon: (
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
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    labelKey: "nav.documents",
    icon: (
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    submenu: [
      {
        labelKey: "nav.documentsBrowse",
        href: "/documents",
        icon: <></>,
      },
      {
        labelKey: "nav.documentsManage",
        href: "/board/documents",
        icon: <></>,
        requiredRoles: [ROLES.VORSTAND, ROLES.ADMIN],
      },
      {
        labelKey: "nav.documentsFolders",
        href: "/admin/documents",
        icon: <></>,
        requiredRoles: [ROLES.ADMIN],
      },
    ],
  },
  {
    labelKey: "nav.communication",
    icon: (
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
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    requiredRoles: [ROLES.VORSTAND, ROLES.ADMIN],
    submenu: [
      {
        labelKey: "nav.emailCampaigns",
        href: "/communication/email-campaigns",
        icon: <></>,
      },
      {
        labelKey: "nav.emailTemplates",
        href: "/communication/email-templates",
        icon: <></>,
      },
    ],
  },
  {
    labelKey: "nav.finance",
    icon: (
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
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    requiredRoles: [ROLES.KASSIER, ROLES.AUDITOR, ROLES.ADMIN],
    submenu: [
      {
        labelKey: "nav.financeDashboard",
        href: "/finance",
        icon: <></>,
      },
      {
        labelKey: "nav.transactions",
        href: "/finance/transactions",
        icon: <></>,
      },
      {
        labelKey: "nav.invoices",
        href: "/finance/invoices",
        icon: <></>,
      },
      {
        labelKey: "nav.payments",
        href: "/finance/payments",
        icon: <></>,
      },
      {
        labelKey: "nav.dunning",
        href: "/finance/dunning",
        icon: <></>,
      },
      {
        labelKey: "nav.receipts",
        href: "/finance/receipts",
        icon: <></>,
      },
      {
        labelKey: "nav.expenseClaims",
        href: "/finance/expense-claims",
        icon: <></>,
      },
      {
        labelKey: "nav.fiscalPeriods",
        href: "/finance/fiscal-periods",
        icon: <></>,
      },
      {
        labelKey: "nav.journalEntries",
        href: "/finance/journal-entries",
        icon: <></>,
        requiresDoubleEntry: true,
      },
      {
        labelKey: "nav.accountingReports",
        href: "/finance/accounting-reports",
        icon: <></>,
        requiresDoubleEntry: true,
      },
      {
        labelKey: "nav.financeSettings",
        href: "/finance/settings",
        icon: <></>,
      },
    ],
  },
  {
    labelKey: "nav.partner",
    icon: (
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
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
    requiredRoles: [ROLES.VORSTAND, ROLES.ADMIN],
    submenu: [
      {
        labelKey: "nav.sponsorsList",
        href: "/sponsors",
        icon: <></>,
      },
      {
        labelKey: "nav.suppliersList",
        href: "/suppliers",
        icon: <></>,
        requiredRoles: [ROLES.ADMIN],
      },
    ],
  },
  {
    labelKey: "nav.admin",
    href: "/admin",
    icon: (
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
  isDoubleEntry: boolean;
  onNavigate: () => void;
  t: (key: string) => string;
  roles: string[];
}

function NavItemWithSubmenu({
  item,
  isActive,
  isOpen,
  isDoubleEntry,
  onNavigate,
  t,
  roles,
}: SidebarItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  if (!item.submenu) {
    return (
      <Link
        href={item.href || "#"}
        onClick={onNavigate}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
          isActive
            ? "bg-orange-100 text-orange-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
        title={!isOpen ? t(item.labelKey) : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        <span
          className={`font-medium whitespace-nowrap transition-opacity duration-200 ${
            isOpen ? "opacity-100" : "lg:w-0 lg:overflow-hidden lg:opacity-0"
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
        className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
          hasActiveChild || isActive
            ? "bg-orange-100 text-orange-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
        title={!isOpen ? t(item.labelKey) : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        <span
          className={`flex-1 text-left font-medium whitespace-nowrap transition-opacity duration-200 ${
            isOpen ? "opacity-100" : "lg:w-0 lg:overflow-hidden lg:opacity-0"
          }`}
        >
          {t(item.labelKey)}
        </span>
        {isOpen && (
          <svg
            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        )}
      </button>

      {/* Submenu */}
      {isOpen && isExpanded && (
        <div className="mt-1 ml-3 space-y-1 border-l border-gray-200 pl-3">
          {item.submenu
            .filter((subitem) => {
              if (subitem.requiresDoubleEntry && !isDoubleEntry) return false;
              if (!subitem.requiredRoles) return true;
              return subitem.requiredRoles.some((role) => roles.includes(role));
            })
            .map((subitem) => {
              const isSubActive =
                pathname === subitem.href ||
                pathname.startsWith(subitem.href + "/");
              return (
                <Link
                  key={subitem.href}
                  href={subitem.href || "#"}
                  onClick={onNavigate}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    isSubActive
                      ? "bg-orange-50 font-medium text-orange-600"
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
  const { settings } = useAppSettings();
  const { isOpen, close } = useSidebar();
  const api = useApiClient();
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const [isDoubleEntry, setIsDoubleEntry] = useState(false);

  // Fetch finance profile to determine accounting mode
  const fetchAccountingMode = useCallback(async () => {
    try {
      const res = await apiRef.current.get("/api/v1/finance/profile");
      if (!res.error && res.data) {
        setIsDoubleEntry((res.data as { accountingMode?: string }).accountingMode === "DoubleEntry");
      }
    } catch {
      // ignore — default to false
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      fetchAccountingMode();
    }
  }, [isAuthenticated, isLoading, fetchAccountingMode]);

  // Re-fetch when the finance profile is updated elsewhere
  useEffect(() => {
    const handler = () => fetchAccountingMode();
    window.addEventListener("finance-profile-changed", handler);
    return () => window.removeEventListener("finance-profile-changed", handler);
  }, [fetchAccountingMode]);

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
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] border-r border-gray-200 bg-white transition-all duration-300 ease-in-out ${
          isOpen
            ? "w-64 translate-x-0"
            : "w-64 -translate-x-full lg:w-20 lg:translate-x-0"
        }`}
      >
        <nav className="flex h-full flex-col py-4">
          {/* Navigation Items */}
          <div className="flex-1 space-y-1 overflow-y-auto px-3">
            {visibleNavItems.map((item) => {
              const isActive = item.href
                ? pathname === item.href || pathname.startsWith(item.href + "/")
                : false;

              return (
                <NavItemWithSubmenu
                  key={item.labelKey}
                  item={item}
                  isActive={isActive}
                  isOpen={isOpen}
                  isDoubleEntry={isDoubleEntry}
                  onNavigate={() => {
                    // Close sidebar on mobile after navigation
                    if (window.innerWidth < 1024) {
                      close();
                    }
                  }}
                  t={t}
                  roles={roles}
                />
              );
            })}
          </div>

          {/* Bottom section - App version or additional info */}
          <div
            className={`border-t border-gray-200 px-3 py-4 transition-opacity duration-200 ${
              isOpen ? "opacity-100" : "lg:opacity-0"
            }`}
          >
            <p className="text-center text-xs text-gray-400">
              {settings.applicationName} v0.5.0
            </p>
          </div>
        </nav>
      </aside>
    </>
  );
}

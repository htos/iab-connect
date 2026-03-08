"use client";

/**
 * REQ-052: Global Search Command Palette
 * Ctrl+K / Cmd+K to open. Searches across Members, Events, Documents, Invoices, Sponsors, Blog.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";

interface SearchResultItem {
  scope: string;
  id: string;
  title: string;
  subtitle: string | null;
  relevance: number;
}

interface SearchResponse {
  items: SearchResultItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  countsByScope: Record<string, number>;
}

/* SVG icon components — consistent with app design (stroke-based, h-5 w-5) */
const ScopeIcon = ({ scope, className }: { scope: string; className?: string }) => {
  const cls = className ?? "h-5 w-5";
  switch (scope) {
    case "members":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case "events":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "documents":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "invoices":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "sponsors":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "blog":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
};

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const SCOPE_CONFIG: Record<string, { route: string; color: string }> = {
  members: { route: "/members", color: "bg-blue-100 text-blue-700" },
  events: { route: "/events", color: "bg-green-100 text-green-700" },
  documents: { route: "/documents", color: "bg-yellow-100 text-yellow-700" },
  invoices: { route: "/finance/invoices", color: "bg-orange-100 text-orange-700" },
  sponsors: { route: "/sponsors", color: "bg-purple-100 text-purple-700" },
  blog: { route: "/blog", color: "bg-pink-100 text-pink-700" },
};

export function GlobalSearch() {
  const t = useTranslations("search");
  const router = useRouter();
  const { accessToken, isAuthenticated, isAdmin, isVorstand, isKassier } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2 || !accessToken) {
        setResults(null);
        return;
      }

      setIsSearching(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const params = new URLSearchParams({ query: searchQuery, pageSize: "10" });
        const response = await fetch(`${baseUrl}/api/v1/search?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const data: SearchResponse = await response.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch {
        // Silent fail for search
      } finally {
        setIsSearching(false);
      }
    },
    [accessToken]
  );

  // Debounce input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  // Navigate to result
  const navigateToResult = useCallback(
    (item: SearchResultItem) => {
      const config = SCOPE_CONFIG[item.scope];
      if (config) {
        router.push(`${config.route}/${item.id}`);
        setIsOpen(false);
      }
    },
    [router]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results.items[selectedIndex]) {
      navigateToResult(results.items[selectedIndex]);
    }
  };

  const canSearch = isAdmin || isVorstand || isKassier;

  if (!isAuthenticated || !canSearch) return null;

  return (
    <>
      {/* Search Trigger — wide search bar that fits naturally into the header */}
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-3 w-full max-w-md rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-400 transition-colors hover:border-gray-400 hover:bg-white"
        title={t("shortcut")}
      >
        <SearchIcon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="flex-1 text-left">{t("placeholder")}</span>
        <kbd className="shrink-0 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-400">
          Ctrl+K
        </kbd>
      </button>
      {/* Mobile: compact icon button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title={t("shortcut")}
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      {/* Modal Overlay — z-50 per design standards */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Dialog */}
          <div className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
            {/* Search Input */}
            <div className="flex items-center border-b border-gray-200 px-4">
              <SearchIcon className="mr-3 h-5 w-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("inputPlaceholder")}
                className="w-full py-4 text-base outline-none placeholder:text-gray-400"
              />
              {isSearching && (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
              )}
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {results && results.items.length > 0 ? (
                <>
                  {/* Scope counts */}
                  <div className="flex flex-wrap gap-2 border-b border-gray-200 px-4 py-2">
                    {Object.entries(results.countsByScope)
                      .filter(([, count]) => count > 0)
                      .map(([scope, count]) => (
                        <span
                          key={scope}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${SCOPE_CONFIG[scope]?.color || "bg-gray-100 text-gray-700"}`}
                        >
                          <ScopeIcon scope={scope} className="h-3 w-3" />
                          {t(`scopes.${scope}`)} ({count})
                        </span>
                      ))}
                    <span className="ml-auto text-xs text-gray-500">
                      {results.totalCount} {t("results")}
                    </span>
                  </div>

                  {/* Result list */}
                  <ul>
                    {results.items.map((item, index) => (
                      <li
                        key={`${item.scope}-${item.id}`}
                        className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                          index === selectedIndex ? "bg-orange-50" : "hover:bg-gray-50"
                        }`}
                        onClick={() => navigateToResult(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                          <ScopeIcon scope={item.scope} className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="truncate text-xs text-gray-500">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${SCOPE_CONFIG[item.scope]?.color || "bg-gray-100 text-gray-600"}`}
                        >
                          {t(`scopes.${item.scope}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : results && results.items.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500">
                  <SearchIcon className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                  <p className="text-sm">{t("noResults")}</p>
                </div>
              ) : query.length > 0 && query.length < 2 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  {t("minChars")}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  {t("hint")}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-400">
              <div className="flex gap-3">
                <span>↑↓ {t("navigate")}</span>
                <span>↵ {t("open")}</span>
                <span>esc {t("close")}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

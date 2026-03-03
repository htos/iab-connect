"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import LanguageSwitcher from "@/components/navigation/LanguageSwitcher";

const navLinks = [
  { href: "/public/events", tKey: "events" },
  { href: "/public/sponsors", tKey: "sponsors" },
  { href: "/public/blog", tKey: "blog" },
  { href: "/public/contact", tKey: "contact" },
] as const;

export default function PublicHeader() {
  const t = useTranslations("publicNav");
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b shadow-sm">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EA580C]">
            <span className="text-sm font-bold text-white">IAB</span>
          </div>
          <span className="hidden text-lg font-semibold text-gray-900 sm:inline">
            IAB Connect
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                isActive(link.href)
                  ? "font-semibold text-orange-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t(link.tKey)}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="hidden rounded-md bg-[#EA580C] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 md:inline-flex"
          >
            {t("login")}
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:text-gray-900 md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? t("closeMenu") : t("openMenu")}
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-b bg-white shadow-lg md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive(link.href)
                    ? "font-semibold text-orange-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t(link.tKey)}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 rounded-md bg-[#EA580C] px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              {t("login")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

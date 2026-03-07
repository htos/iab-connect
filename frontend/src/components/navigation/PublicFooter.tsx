"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function PublicFooter() {
  const t = useTranslations("publicFooter");

  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EA580C]">
                <span className="text-sm font-bold text-white">IAB</span>
              </div>
              <span className="text-lg font-semibold">IAB Connect</span>
            </div>
            <p className="mt-3 text-sm text-gray-400">
              {t("description")}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              {t("quickLinks")}
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/public/events"
                  className="text-sm text-gray-300 transition-colors hover:text-white"
                >
                  {t("events")}
                </Link>
              </li>
              <li>
                <Link
                  href="/public/sponsors"
                  className="text-sm text-gray-300 transition-colors hover:text-white"
                >
                  {t("sponsors")}
                </Link>
              </li>
              <li>
                <Link
                  href="/public/blog"
                  className="text-sm text-gray-300 transition-colors hover:text-white"
                >
                  {t("blog")}
                </Link>
              </li>
              <li>
                <Link
                  href="/public/newsletter"
                  className="text-sm text-gray-300 transition-colors hover:text-white"
                >
                  {t("newsletter")}
                </Link>
              </li>
              <li>
                <Link
                  href="/public/contact"
                  className="text-sm text-gray-300 transition-colors hover:text-white"
                >
                  {t("contact")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              {t("legal")}
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/public/privacy"
                  className="text-sm text-gray-300 transition-colors hover:text-white"
                >
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/public/imprint"
                  className="text-sm text-gray-300 transition-colors hover:text-white"
                >
                  {t("imprint")}
                </Link>
              </li>
              <li>
                <Link
                  href="/public/contact"
                  className="text-sm text-gray-300 transition-colors hover:text-white"
                >
                  {t("contact")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-gray-800 pt-6 text-center text-sm text-gray-400">
          {t("copyright")}
        </div>
      </div>
    </footer>
  );
}

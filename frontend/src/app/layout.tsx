import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MainLayout } from "@/components/navigation";
import { BetaBanner } from "@/components/navigation/BetaBanner";
import { LicenseFooter } from "@/components/navigation/LicenseFooter";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// REQ-086 (E9-S2): browser metadata is de-branded — the tab title/description reflect
// the configured organization, fetched server-side from the same public settings
// endpoint the client provider uses. A neutral fallback applies if the fetch fails.
export async function generateMetadata(): Promise<Metadata> {
  const fallback: Metadata = {
    title: "Organization Connect",
    description: "Web application for your organization",
    icons: { icon: "/favicon.ico" },
  };

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
    const response = await fetch(`${baseUrl}/api/v1/settings/public`, {
      // Settings change rarely; let Next revalidate periodically rather than per request.
      next: { revalidate: 300 },
      // REQ-086 (E9 review patch): bound the request — a slow/hanging backend must not
      // stall server-side rendering of every page. revalidate caches the result, not the
      // latency of a stuck request.
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      return fallback;
    }
    const data = await response.json();
    return {
      title: data.applicationName || fallback.title,
      description: data.description || fallback.description,
      icons: { icon: "/favicon.ico" },
    };
  } catch {
    return fallback;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable}>
      <body className="bg-background min-h-screen font-sans antialiased">
        <Providers>
          <NextIntlClientProvider messages={messages}>
            {/* BetaBanner mounted above MainLayout; LicenseFooter (E20-S4) lands as sibling AFTER MainLayout. */}
            <BetaBanner />
            <MainLayout>{children}</MainLayout>
            <LicenseFooter />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}

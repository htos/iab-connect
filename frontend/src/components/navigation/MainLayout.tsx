"use client";

/**
 * Main Layout Component
 * Combines Header and Sidebar with main content area
 * Handles responsive layout adjustments
 */
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "@/lib/auth";

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const { isOpen } = useSidebar();
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <main className="pt-16">{children}</main>
    );
  }

  // Not authenticated - no sidebar
  if (!isAuthenticated) {
    return (
      <main className="pt-16">{children}</main>
    );
  }

  // Authenticated - with sidebar
  return (
    <>
      <Sidebar />
      <main
        className={`pt-16 min-h-screen transition-all duration-300 ease-in-out ${
          isOpen ? "lg:ml-64" : "lg:ml-20"
        }`}
      >
        {children}
      </main>
    </>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Full-page layouts (no sidebar, no internal header) for these routes
  const isFullPageLayout = pathname === "/login" || pathname.startsWith("/auth/") || pathname.startsWith("/public");

  if (isFullPageLayout) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <Suspense fallback={<main className="pt-16">{children}</main>}>
        <MainLayoutContent>{children}</MainLayoutContent>
      </Suspense>
    </>
  );
}

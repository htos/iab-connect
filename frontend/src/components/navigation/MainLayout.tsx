"use client";

/**
 * Main Layout Component
 * Combines Header and Sidebar with main content area
 * Handles responsive layout adjustments
 */
import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "@/lib/auth";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isOpen } = useSidebar();
  const { isAuthenticated, isLoading } = useAuth();

  // Full-page layouts (no sidebar) for these routes
  const isFullPageLayout = pathname === "/login" || pathname.startsWith("/auth/");

  if (isFullPageLayout) {
    return <>{children}</>;
  }

  // Show loading state
  if (isLoading) {
    return (
      <>
        <Header />
        <main className="pt-16">{children}</main>
      </>
    );
  }

  // Not authenticated - no sidebar
  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <main className="pt-16">{children}</main>
      </>
    );
  }

  // Authenticated - with sidebar
  return (
    <>
      <Header />
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

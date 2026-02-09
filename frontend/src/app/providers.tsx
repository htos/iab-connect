"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { SidebarProvider } from "@/components/navigation/SidebarContext";
import { AppSettingsProvider } from "@/components/providers/AppSettingsProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <AppSettingsProvider>{children}</AppSettingsProvider>
        </SidebarProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

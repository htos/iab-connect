"use client";

/**
 * Auth Provider for IAB Connect
 * REQ-001: Wraps the app with NextAuth SessionProvider
 */
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
}

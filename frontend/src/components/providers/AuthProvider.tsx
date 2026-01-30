"use client";

/**
 * Auth Provider for IAB Connect
 * REQ-001: Wraps the app with NextAuth SessionProvider
 * REQ-011: Includes LoginTracker for audit logging
 */
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { LoginTracker } from "./LoginTracker";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider>
      <LoginTracker />
      {children}
    </SessionProvider>
  );
}

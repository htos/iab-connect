"use client";

/**
 * Login Tracker Component
 * REQ-011: Tracks successful logins to the audit log
 *
 * This component monitors the session state and sends a login event
 * to the backend when a user successfully authenticates.
 */
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

const LOGIN_TRACKED_KEY = "iab_login_tracked";

export function LoginTracker() {
  const { data: session, status } = useSession();
  const hasTracked = useRef(false);

  useEffect(() => {
    console.log("[LoginTracker] Effect triggered - status:", status, "hasToken:", !!session?.accessToken, "hasTracked:", hasTracked.current);

    // Only track when authenticated and not already tracked in this session
    if (status !== "authenticated") {
      console.log("[LoginTracker] Skipping - not authenticated yet");
      return;
    }

    if (!session?.accessToken) {
      console.log("[LoginTracker] Skipping - no access token in session");
      return;
    }

    if (hasTracked.current) {
      console.log("[LoginTracker] Skipping - already tracked in this component instance");
      return;
    }

    // Check if we already tracked this session (in case of component re-mount)
    const sessionTracked = sessionStorage.getItem(LOGIN_TRACKED_KEY);
    const tokenPrefix = session.accessToken?.substring(0, 20);
    if (sessionTracked === tokenPrefix) {
      hasTracked.current = true;
      console.log("[LoginTracker] Skipping - already tracked in sessionStorage");
      return;
    }

    // Track the login
    const trackLogin = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        console.log("[LoginTracker] Sending login track to:", `${baseUrl}/api/v1/audit/login`);

        const response = await fetch(`${baseUrl}/api/v1/audit/login`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
        });

        console.log("[LoginTracker] Response status:", response.status);

        if (response.ok) {
          // Mark as tracked to prevent duplicate entries
          hasTracked.current = true;
          sessionStorage.setItem(LOGIN_TRACKED_KEY, tokenPrefix || "tracked");
          console.log("[LoginTracker] Login tracked successfully");
        } else {
          const errorText = await response.text();
          console.warn("[LoginTracker] Failed to track login:", response.status, errorText);
        }
      } catch (error) {
        // Don't fail silently but also don't block the user
        console.error("[LoginTracker] Error tracking login:", error);
      }
    };

    trackLogin();
  }, [session, status]);

  // This component doesn't render anything
  return null;
}

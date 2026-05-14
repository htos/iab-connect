"use client";

/**
 * App Settings Context
 * REQ-059: Provides dynamic application name and logo settings to all components
 * REQ-086 (E9-S1): extended with organization description, primary color,
 * public-site toggle, and an uploaded logo URL.
 * Fetches from /api/v1/settings/public (no auth required)
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { sanitizeModuleMap } from "@/lib/modules";

interface AppSettings {
  applicationName: string;
  logoText: string;
  logoBackgroundColor: string;
  logoTextColor: string;
  description: string;
  primaryColor: string;
  publicSiteEnabled: boolean;
  logoUrl: string | null;
  // REQ-087 (E10-S4): module-key -> enabled map, sourced from the `modules` field of
  // GET /api/v1/settings/public (E10-S2). Drives sidebar/dashboard/route-guard hiding.
  modules: Record<string, boolean>;
}

interface AppSettingsContextType {
  settings: AppSettings;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  applicationName: "Association Connect by Harwinder Singh",
  logoText: "AC",
  logoBackgroundColor: "#EA580C",
  logoTextColor: "#FFFFFF",
  description: "",
  primaryColor: "#EA580C",
  publicSiteEnabled: true,
  logoUrl: null,
  // REQ-087 (E10-S4): all modules enabled by default — behaviour-preserving until the
  // public settings endpoint reports otherwise (or while it is unreachable).
  modules: {
    members: true,
    events: true,
    documents: true,
    communication: true,
    finance: true,
    partners: true,
    public_view: true,
  },
};

const AppSettingsContext = createContext<AppSettingsContextType>({
  settings: defaultSettings,
  isLoading: true,
  refresh: async () => {},
});

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
      const response = await fetch(`${baseUrl}/api/v1/settings/public`);
      if (response.ok) {
        const data = await response.json();
        setSettings({
          applicationName:
            data.applicationName || defaultSettings.applicationName,
          logoText: data.logoText || defaultSettings.logoText,
          logoBackgroundColor:
            data.logoBackgroundColor || defaultSettings.logoBackgroundColor,
          logoTextColor: data.logoTextColor || defaultSettings.logoTextColor,
          description: data.description || defaultSettings.description,
          primaryColor: data.primaryColor || defaultSettings.primaryColor,
          publicSiteEnabled:
            data.publicSiteEnabled ?? defaultSettings.publicSiteEnabled,
          // The public endpoint returns a relative path; resolve it against the
          // API base so <img> tags get an absolute, stable URL.
          logoUrl: data.logoUrl ? `${baseUrl}${data.logoUrl}` : null,
          // REQ-087 (E10-S4): module map from E10-S2's public settings endpoint.
          // Review patch: validate the shape — a malformed `modules` field (array,
          // string, string-valued booleans) must not silently disable all gating.
          // Sanitized valid entries override the all-true defaults; anything dropped
          // keeps its default `true` (behaviour-preserving).
          modules: {
            ...defaultSettings.modules,
            ...sanitizeModuleMap(data.modules),
          },
        });
      }
    } catch {
      // Use defaults on error — the app should still work
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <AppSettingsContext.Provider
      value={{ settings, isLoading, refresh: fetchSettings }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

/**
 * Hook to access app settings (name, logo, colors)
 */
export function useAppSettings() {
  return useContext(AppSettingsContext);
}

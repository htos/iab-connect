"use client";

/**
 * App Settings Context
 * REQ-059: Provides dynamic application name and logo settings to all components
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

interface AppSettings {
  applicationName: string;
  logoText: string;
  logoBackgroundColor: string;
  logoTextColor: string;
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

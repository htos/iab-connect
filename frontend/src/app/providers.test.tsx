// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useQueryClient } from "@tanstack/react-query";

// E30-S3 app-shell regression net: proves the provider tree mounts in order and the
// QueryClient + Sidebar + AppSettings contexts are available to children. Asserts
// observable AVAILABILITY (not private QueryClient config — that stays frozen in source).

// SessionProvider would hit /api/auth/session on mount — stub it as a passthrough.
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { Providers } from "./providers";
import { useSidebar } from "@/components/navigation/SidebarContext";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";

// A child that consumes all three contexts — if any provider is missing/out of order,
// useQueryClient/useSidebar throw and the render fails.
function Probe() {
  const queryClient = useQueryClient();
  const sidebar = useSidebar();
  const appSettings = useAppSettings();
  return (
    <div
      data-testid="probe"
      data-has-query-client={String(!!queryClient)}
      data-has-sidebar={String(!!sidebar)}
      data-has-app-settings={String(!!appSettings)}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Providers (app-shell regression net — E30-S3)", () => {
  it("mounts the tree and exposes the QueryClient + Sidebar + AppSettings contexts", () => {
    // AppSettingsProvider fetches /api/v1/settings/public on mount; a never-resolving
    // fetch keeps it on defaults without a real network call or a late setState.
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    expect(() =>
      render(
        <Providers>
          <Probe />
        </Providers>
      )
    ).not.toThrow();

    const probe = screen.getByTestId("probe");
    expect(probe).toHaveAttribute("data-has-query-client", "true");
    expect(probe).toHaveAttribute("data-has-sidebar", "true");
    expect(probe).toHaveAttribute("data-has-app-settings", "true");
  });
});

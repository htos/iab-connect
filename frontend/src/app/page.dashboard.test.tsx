// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { formatCHF } from "@/lib/utils";

// E30-S4 root-dashboard characterization net (FULL coverage; extends the E30-S3 seed).
// Sibling to the pre-existing `page.test.tsx` (REQ-086 hero-branding anchor, untouched).
// This is the transport-agnostic oracle (A103): renders the route entry (`./page`)
// directly with NO provider wrapper — at HEAD the god-page manual-fetches; after the
// E30-S4 slice migration the thin entry → DashboardContent self-wraps its own
// QueryClientProvider. It pins the 3-way render branch, the no-redirect invariant,
// every module gate (REQ-087 `!== false`), the role badges, the KPI success/error
// copy (A79), and the canViewKpis fetch gate (A97). Uses the real next/link for hrefs.

const ALL_FALSE = {
  isAuthenticated: false,
  isLoading: false,
  user: null as { name?: string } | null,
  roles: [] as string[],
  isAdmin: false,
  isVorstand: false,
  isMember: false,
  canReadFinance: false,
};

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  get: vi.fn(),
  auth: {
    isAuthenticated: false,
    isLoading: false,
    user: null as { name?: string } | null,
    roles: [] as string[],
    isAdmin: false,
    isVorstand: false,
    isMember: false,
    canReadFinance: false,
  },
  settings: {
    applicationName: "TestOrg",
    logoBackgroundColor: "#111111",
    logoTextColor: "#ffffff",
    logoText: "TO",
    modules: {} as Record<string, boolean>,
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mocks.auth,
  useApiClient: () => ({ get: mocks.get }),
}));

// Stable identity translator (A64/A78): the page keeps `t` in fetchKpis deps. Both
// useTranslations() and useTranslations("dashboard") return the same identity fn.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// The page does NOT import next/navigation today — mock defensively so a future
// regression that adds a redirect is caught by the "push not called" assertions.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: () => ({ settings: mocks.settings }),
}));

vi.mock("@/components/OnboardingBanner", () => ({
  OnboardingBanner: () => <div data-testid="onboarding-banner" />,
}));

import HomePage from "./page";

// A full DashboardOverview payload with deliberately-distinctive numbers so a KPI
// value assertion can't accidentally collide with another card.
const PAYLOAD = {
  members: {
    totalMembers: 42,
    activeMembers: 30,
    pendingMembers: 5,
    inactiveMembers: 4,
    suspendedMembers: 2,
    newMembersInPeriod: 7,
    monthlyTrend: [],
  },
  events: {
    totalEvents: 11,
    upcomingEvents: 6,
    completedEvents: 3,
    cancelledEvents: 1,
    totalRegistrations: 88,
    totalParticipantsConfirmed: 77,
    totalEventRevenue: 0,
    byCategory: [],
  },
  finance: {
    totalIncome: 98765,
    totalExpense: 4321,
    balance: 94444,
    outstandingInvoices: 0,
    overdueInvoiceCount: 9,
    overdueAmount: 0,
    openInvoiceCount: 13,
    pendingPayments: 0,
    pendingPaymentCount: 8,
    pendingExpenseClaims: 0,
    pendingExpenseClaimCount: 6,
    currentFiscalPeriod: null,
    currentPeriodStatus: null,
  },
};

beforeEach(() => {
  mocks.push.mockReset();
  mocks.get.mockReset();
  // Default: a never-resolving fetch — quick-action/role assertions are synchronous and
  // this avoids a late setState (god-page) / query commit (slice) after the test ends.
  mocks.get.mockReturnValue(new Promise(() => {}));
  mocks.auth = { ...ALL_FALSE };
  mocks.settings = {
    applicationName: "TestOrg",
    logoBackgroundColor: "#111111",
    logoTextColor: "#ffffff",
    logoText: "TO",
    modules: {},
  };
});

afterEach(cleanup);

describe("HomePage / root dashboard — 3-way branch + no redirect", () => {
  it("shows the loading spinner while auth is resolving", () => {
    mocks.auth = { ...ALL_FALSE, isLoading: true };
    render(<HomePage />);
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("renders the unauthenticated landing with the public + login links and does NOT redirect", () => {
    mocks.auth = { ...ALL_FALSE, isAuthenticated: false };
    render(<HomePage />);
    expect(
      screen.getByRole("link", { name: "publicNav.events" })
    ).toHaveAttribute("href", "/public/events");
    expect(
      screen.getByRole("link", { name: "publicNav.blog" })
    ).toHaveAttribute("href", "/public/blog");
    expect(
      screen.getByRole("link", { name: "publicNav.contact" })
    ).toHaveAttribute("href", "/public/contact");
    expect(screen.getByRole("link", { name: "auth.signIn" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("renders the authenticated dashboard (onboarding banner + permissions) and does NOT redirect", () => {
    mocks.auth = { ...ALL_FALSE, isAuthenticated: true, isMember: true };
    render(<HomePage />);
    expect(screen.getByTestId("onboarding-banner")).toBeInTheDocument();
    expect(screen.getByText("home.yourPermissions")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("HomePage / root dashboard — role badges", () => {
  it("shows the admin badge for an admin", () => {
    mocks.auth = { ...ALL_FALSE, isAuthenticated: true, isAdmin: true };
    render(<HomePage />);
    expect(screen.getByText("roles.admin")).toBeInTheDocument();
  });

  it("shows the board badge for a Vorstand", () => {
    mocks.auth = { ...ALL_FALSE, isAuthenticated: true, isVorstand: true };
    render(<HomePage />);
    expect(screen.getByText("roles.board")).toBeInTheDocument();
  });

  it("shows the member badge for a member", () => {
    mocks.auth = { ...ALL_FALSE, isAuthenticated: true, isMember: true };
    render(<HomePage />);
    expect(screen.getByText("roles.member")).toBeInTheDocument();
  });
});

describe("HomePage / root dashboard — module gates (REQ-087 `!== false`)", () => {
  // Vorstand sees every module-gated quick-action (the role gate passes), so toggling
  // each module isolates the module gate itself.
  const GATES = [
    { module: "events", href: "/events" },
    { module: "documents", href: "/documents" },
    { module: "members", href: "/members" },
    { module: "communication", href: "/communication" },
    { module: "finance", href: "/finance" },
    { module: "partners", href: "/sponsors" },
  ];

  it.each(GATES)(
    "hides the $module quick-action when settings.modules.$module === false",
    ({ module, href }) => {
      mocks.auth = { ...ALL_FALSE, isAuthenticated: true, isVorstand: true };
      mocks.settings.modules = { [module]: false };
      const { container } = render(<HomePage />);
      expect(container.querySelector(`a[href="${href}"]`)).toBeNull();
    }
  );

  it.each(GATES)(
    "shows the $module quick-action when the module is enabled (default-on undefined !== false)",
    ({ href }) => {
      mocks.auth = { ...ALL_FALSE, isAuthenticated: true, isVorstand: true };
      mocks.settings.modules = {}; // undefined → `!== false` is true → shown
      const { container } = render(<HomePage />);
      expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
  );

  it("shows the Admin quick-action only for an admin (no module gate)", () => {
    mocks.auth = { ...ALL_FALSE, isAuthenticated: true, isVorstand: true };
    const vorstand = render(<HomePage />);
    expect(vorstand.container.querySelector('a[href="/admin"]')).toBeNull();
    cleanup();

    mocks.auth = { ...ALL_FALSE, isAuthenticated: true, isAdmin: true };
    const admin = render(<HomePage />);
    expect(admin.container.querySelector('a[href="/admin"]')).not.toBeNull();
  });
});

describe("HomePage / root dashboard — KPI data path (A97 gate, A79 copy)", () => {
  it("does not fetch KPIs when the user cannot view them (not Vorstand/Admin)", () => {
    mocks.auth = { ...ALL_FALSE, isAuthenticated: true, isMember: true };
    render(<HomePage />);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("fetches /api/v1/reports/dashboard and renders KPI cards with formatCHF for a Vorstand", async () => {
    mocks.auth = {
      ...ALL_FALSE,
      isAuthenticated: true,
      isVorstand: true,
      canReadFinance: true,
    };
    mocks.settings.modules = {};
    mocks.get.mockResolvedValue({ data: PAYLOAD, error: null, status: 200 });

    render(<HomePage />);

    expect(await screen.findByText("members.title")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("/api/v1/reports/dashboard");
    // formatCHF output is preserved (A79 — the finance KPIs are CHF-formatted).
    // Identity normalizer: de-CH currency uses a narrow no-break space (U+202F) that
    // Testing Library's default normalizer would collapse, breaking the exact match.
    expect(
      screen.getByText(formatCHF(98765), { normalizer: (s) => s })
    ).toBeInTheDocument();
  });

  it("renders the KPI error copy from the API error string (A79 — copy preserved)", async () => {
    mocks.auth = { ...ALL_FALSE, isAuthenticated: true, isVorstand: true };
    mocks.get.mockResolvedValue({
      data: null,
      error: "KPI backend exploded",
      status: 500,
    });

    render(<HomePage />);

    expect(await screen.findByText("KPI backend exploded")).toBeInTheDocument();
  });
});

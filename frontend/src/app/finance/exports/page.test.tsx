// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ============================================================================
// E26-S1 (S5 banking/data) — exports characterization net.
//
// Guard variant CONFIRMED: LEAN canReadFinance-ONLY.
//   - effect: `if (!canReadFinance) router.replace("/")`  → redirect TARGET = "/"
//   - render: `if (!canReadFinance) return null`
//   - NO isLoading/authLoading wait (premature-redirect-on-cold-session quirk;
//     a cold session with canReadFinance=false redirects immediately) — pinned AS-IS.
//   - exports is READ-ONLY: it reads canReadFinance but does NOT read canWriteFinance.
//
// AC-6 download pins owned here (blob path):
//   - journal:    api.get(`/api/v1/finance/exports/journal?from=${from}&to=${to}`)
//                 URL is built by STRING INTERPOLATION, NOT URLSearchParams — pinned.
//                 → blob → window.URL.createObjectURL → anchor download="journal.csv"
//                 → a.click() → window.URL.revokeObjectURL. Anchor is NOT DOM-appended.
//   - open-items: api.get("/api/v1/finance/exports/open-items")
//                 → blob → download="open-items.csv" → click → revoke. Anchor NOT appended.
//
// A79 deltas: useApiClient direct (BUILD-on-useApiClient; mock survives migration).
// A56: on failure the page surfaces the i18n key `loadError` (translator returns key) —
//   this IS a real i18n call (tRef.current("loadError")), unlike bank-import's literals.
// ============================================================================

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/finance/exports",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href?: string;
  }) => <a href={typeof href === "string" ? href : "#"}>{children}</a>,
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
const authState = {
  isAuthenticated: true,
  isLoading: false,
  canReadFinance: true,
  canWriteFinance: true,
  isAdmin: true,
  isVorstand: true,
  isKassier: true,
  isAuditor: false,
  user: { name: "Kassier", email: "kassier@example.org" },
  accessToken: "tok",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
    upload: apiUpload,
  }),
}));

import ExportsPage from "./page";

// A CSV blob fixture for the download path.
const CSV_BLOB = new Blob(["a;b\n1;2"], { type: "text/csv" });

// Capture every anchor the page creates so we can assert download attrs +
// that it is NOT appended to document.body (exports-specific, vs transactions).
let createdAnchors: HTMLAnchorElement[] = [];
let appendSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();

  createdAnchors = [];
  const origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    const el = origCreateElement(tag);
    if (tag === "a") {
      const a = el as HTMLAnchorElement;
      a.click = vi.fn();
      createdAnchors.push(a);
    }
    return el;
  }) as typeof document.createElement);
  appendSpy = vi.spyOn(document.body, "appendChild") as unknown as ReturnType<
    typeof vi.fn
  >;

  apiGet.mockResolvedValue({ data: CSV_BLOB, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  Object.assign(authState, {
    isAuthenticated: true,
    isLoading: false,
    canReadFinance: true,
    canWriteFinance: true,
    isAdmin: true,
    isVorstand: true,
    isKassier: true,
    isAuditor: false,
  });
});

describe("exports — read guard (AC-2: lean canReadFinance-only, replace('/'), no isLoading wait)", () => {
  it("redirects to / via router.replace and returns null when !canReadFinance", () => {
    authState.canReadFinance = false;
    const { container } = render(<ExportsPage />);

    // LEAN guard uses replace (NOT push) with target "/".
    expect(replace).toHaveBeenCalledWith("/");
    expect(push).not.toHaveBeenCalled();
    // return null → nothing rendered.
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("exports")).not.toBeInTheDocument();
  });

  it("renders both export cards for a read user", () => {
    render(<ExportsPage />);
    expect(screen.getByText("exports")).toBeInTheDocument();
    expect(screen.getByText("journalExport")).toBeInTheDocument();
    expect(screen.getByText("openItemsExport")).toBeInTheDocument();
    // No redirect for an authorized read user.
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("exports — AC-6 journal download (string-interpolated URL, hardcoded journal.csv, anchor NOT appended)", () => {
  it("GETs the journal blob with a STRING-INTERPOLATED from/to query (not URLSearchParams)", async () => {
    render(<ExportsPage />);

    const fromInput = screen
      .getByText("from")
      .parentElement!.querySelector("input") as HTMLInputElement;
    const toInput = screen
      .getByText("to")
      .parentElement!.querySelector("input") as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: "2026-01-01" } });
    fireEvent.change(toInput, { target: { value: "2026-03-31" } });

    fireEvent.click(screen.getByText("exportJournal"));

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        "/api/v1/finance/exports/journal?from=2026-01-01&to=2026-03-31"
      );
    });
  });

  it("downloads via object-URL anchor download='journal.csv' that is NOT DOM-appended, then revokes", async () => {
    render(<ExportsPage />);
    fireEvent.click(screen.getByText("exportJournal"));

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(CSV_BLOB);
    });
    const anchor = createdAnchors.find((a) => a.download === "journal.csv");
    expect(anchor).toBeTruthy();
    expect(anchor!.href).toContain("blob:mock");
    expect(anchor!.click).toHaveBeenCalled();
    // Exports-specific: the anchor is NEVER appended to document.body.
    expect(appendSpy).not.toHaveBeenCalledWith(anchor!);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("surfaces the loadError i18n key when the journal export GET fails", async () => {
    apiGet.mockResolvedValue({
      data: null,
      error: "server boom",
      status: 500,
    });
    render(<ExportsPage />);
    fireEvent.click(screen.getByText("exportJournal"));

    await waitFor(() => {
      expect(screen.getByText("loadError")).toBeInTheDocument();
    });
  });
});

describe("exports — AC-6 open-items download (fixed URL, hardcoded open-items.csv, anchor NOT appended)", () => {
  it("GETs the open-items blob at the fixed URL (no query)", async () => {
    render(<ExportsPage />);
    fireEvent.click(screen.getByText("exportOpenItems"));

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/exports/open-items");
    });
  });

  it("downloads via object-URL anchor download='open-items.csv' that is NOT DOM-appended, then revokes", async () => {
    render(<ExportsPage />);
    fireEvent.click(screen.getByText("exportOpenItems"));

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(CSV_BLOB);
    });
    const anchor = createdAnchors.find((a) => a.download === "open-items.csv");
    expect(anchor).toBeTruthy();
    expect(anchor!.click).toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalledWith(anchor!);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("surfaces the loadError i18n key when the open-items export GET fails", async () => {
    apiGet.mockResolvedValue({ data: null, error: "boom", status: 500 });
    render(<ExportsPage />);
    fireEvent.click(screen.getByText("exportOpenItems"));

    await waitFor(() => {
      expect(screen.getByText("loadError")).toBeInTheDocument();
    });
  });
});

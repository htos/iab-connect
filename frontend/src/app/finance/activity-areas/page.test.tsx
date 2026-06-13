// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ============================================================================
// E26-S1 (REQ-068) S4 char-net — activity-areas (manage + report tabs).
// Behaviour-preservation ORACLE, GREEN at HEAD. Pin AS-IS (DEC-2=A).
//
// A56 notes / deltas:
// - Guard: `if (authLoading || loading) return <skeleton>` THEN `if (!canReadFinance) return null`
//   (NO router, NO redirect). DIVERGENCE from the brief's "spinner→return null": because `loading`
//   initialises to true and the fetch effect is gated on canReadFinance, a read-DENIED cold session
//   never clears `loading`, so the SKELETON wins and the null surface is unreachable. Pinned AS-IS:
//   the load-bearing guarantee is that NO finance GET fires for a read-denied user.
// - useApiClient-direct (BUILD-on-useApiClient); GET returns `{ items }` envelope.
// - AC-5 delete: INLINE two-step confirm (NOT a modal); destructive confirm is bg-red-600.
// - toggle-active = PUT to the SAME /activity-areas/{id} with the full payload, isActive flipped.
// - HARDCODED-ENGLISH error strings (save/delete/toggle/load) — asserted LITERALLY, NOT translated.
// - Page-local `formatCurrency` (de-CH, NO currency symbol): 1234.5 → "1’234.50", 500 → "500.00".
// - Report rows are SERVER-supplied; the page only sums them + picks balance>=0 colour.
// - A96: NO submitted field trimmed. A95: no out-of-set <select> here (isActive is a boolean toggle).
// ============================================================================

const authState = {
  isLoading: false,
  canReadFinance: true,
  canWriteFinance: true,
};

// next-intl: STABLE identity translator (A64/A78 — the page keeps `t` in effect-dep chains via
// useCallback closures; a fresh fn per render would re-fire effects).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// next/link: passthrough
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
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isLoading: authState.isLoading,
    canReadFinance: authState.canReadFinance,
    canWriteFinance: authState.canWriteFinance,
  }),
  useApiClient: () => ({
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
  }),
}));

import ActivityAreasPage from "./page";

const AREA = {
  id: "a1",
  name: "Events",
  code: "EVT",
  description: "Cultural events",
  color: "#f97316",
  isActive: true,
  sortOrder: 0,
};

const INACTIVE_AREA = {
  id: "a2",
  name: "Archive",
  code: "ARC",
  description: null,
  color: null,
  isActive: false,
  sortOrder: 1,
};

const REPORT_ROWS = [
  {
    activityAreaId: "a1",
    activityAreaName: "Events",
    activityAreaCode: "EVT",
    totalIncome: 1234.5,
    totalExpense: 234.5,
    balance: 1000,
  },
  {
    activityAreaId: null,
    activityAreaName: null,
    activityAreaCode: null,
    totalIncome: 0,
    totalExpense: 500,
    balance: -500,
  },
];

function wireApi(areas: unknown[] = [AREA], report: unknown[] = REPORT_ROWS) {
  apiGet.mockImplementation((url: string) => {
    if (url.includes("/activity-areas/report")) {
      return Promise.resolve({ data: report, error: null });
    }
    // GET /activity-areas → { items }
    return Promise.resolve({ data: { items: areas }, error: null });
  });
}

beforeEach(() => {
  apiPost.mockResolvedValue({ data: {}, error: null });
  apiPut.mockResolvedValue({ data: {}, error: null });
  apiDelete.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isLoading = false;
  authState.canReadFinance = true;
  authState.canWriteFinance = true;
});

describe("ActivityAreasPage — guards (AC-2 spinner→return null, no redirect)", () => {
  it("renders the pulse skeleton while auth is loading", () => {
    authState.isLoading = true;
    wireApi();
    const { container } = render(<ActivityAreasPage />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("title")).not.toBeInTheDocument();
  });

  it("does NOT fire the finance GET for a user without finance read", async () => {
    authState.canReadFinance = false;
    wireApi();
    const { container } = render(<ActivityAreasPage />);
    // A56 note (pin AS-IS): `loading` initialises to true and the fetch effect is gated on
    // canReadFinance, so the `authLoading || loading` skeleton wins BEFORE the
    // `if (!canReadFinance) return null` line is ever reached on a cold session — the page shows
    // the pulse SKELETON (never the null surface) for a read-denied user. The load-bearing
    // behaviour is that NO finance GET is fired and no data/list renders.
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("title")).not.toBeInTheDocument();
    expect(
      apiGet.mock.calls.some((c) => String(c[0]).includes("/activity-areas"))
    ).toBe(false);
  });
});

describe("ActivityAreasPage — manage tab list (AC-4)", () => {
  it("GETs /activity-areas and renders sorted rows", async () => {
    wireApi([INACTIVE_AREA, AREA]);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    expect(
      apiGet.mock.calls.some((c) => c[0] === "/api/v1/finance/activity-areas")
    ).toBe(true);
    // Both rows present.
    expect(screen.getByText("Archive")).toBeInTheDocument();
  });

  it("shows the empty state when there are no areas", async () => {
    wireApi([]);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("noActivityAreas")).toBeInTheDocument();
    });
  });
});

describe("ActivityAreasPage — write-gate (AC-3)", () => {
  it("shows Add + row edit/delete for writers", async () => {
    wireApi([AREA]);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("addActivityArea")).toBeInTheDocument();
    });
    expect(screen.getByTitle("edit")).toBeInTheDocument();
    expect(screen.getByTitle("delete")).toBeInTheDocument();
  });

  it("hides Add + actions for a read-only user; the active cell becomes a static badge", async () => {
    authState.canWriteFinance = false;
    wireApi([AREA]);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    expect(screen.queryByText("addActivityArea")).not.toBeInTheDocument();
    expect(screen.queryByTitle("edit")).not.toBeInTheDocument();
    expect(screen.queryByTitle("delete")).not.toBeInTheDocument();
    // The yes/no active cell is NOT a button for read-only users.
    expect(screen.queryByTitle("deactivate")).not.toBeInTheDocument();
    expect(screen.queryByTitle("activate")).not.toBeInTheDocument();
  });
});

describe("ActivityAreasPage — create + edit (AC-4)", () => {
  it("POSTs a new area WITHOUT isActive (create payload omits it)", async () => {
    wireApi([]);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("addActivityArea")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("addActivityArea"));

    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "New Area" },
    });
    fireEvent.change(screen.getByPlaceholderText("codePlaceholder"), {
      target: { value: "NEW" },
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/activity-areas",
        expect.objectContaining({
          name: "New Area",
          code: "NEW",
          description: null,
          color: null,
          sortOrder: 0,
        })
      );
    });
    const payload = apiPost.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("isActive");
  });

  it("PUTs the edited area to /{id} WITH isActive", async () => {
    wireApi([AREA]);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("edit"));
    await waitFor(() => {
      expect(screen.getByText("editActivityArea")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/activity-areas/a1",
        expect.objectContaining({
          name: "Events",
          code: "EVT",
          sortOrder: 0,
          isActive: true,
        })
      );
    });
  });
});

describe("ActivityAreasPage — toggle-active (AC-3 write-gate, AC-4 PUT same /{id})", () => {
  it("clicking the active badge PUTs /{id} with isActive flipped", async () => {
    wireApi([AREA]);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    // Active area → the toggle button is titled "deactivate" and shows common.yes.
    const toggle = screen.getByTitle("deactivate");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/activity-areas/a1",
        expect.objectContaining({ isActive: false })
      );
    });
  });

  it("an inactive area's toggle is titled 'activate'", async () => {
    wireApi([INACTIVE_AREA]);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Archive")).toBeInTheDocument();
    });
    expect(screen.getByTitle("activate")).toBeInTheDocument();
  });
});

describe("ActivityAreasPage — inline two-step confirm delete (AC-5)", () => {
  it("first click arms a red inline confirm; second DELETEs /{id}", async () => {
    wireApi([AREA]);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("delete"));
    expect(apiDelete).not.toHaveBeenCalled();

    const confirmBtn = screen.getByText("confirm");
    expect(confirmBtn.className).toContain("bg-red-600");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/finance/activity-areas/a1"
      );
    });
  });

  it("cancelling the inline confirm fires NO DELETE", async () => {
    wireApi([AREA]);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("delete"));
    fireEvent.click(screen.getByText("cancel"));
    expect(apiDelete).not.toHaveBeenCalled();
    expect(screen.queryByText("confirm")).not.toBeInTheDocument();
  });
});

describe("ActivityAreasPage — HARDCODED-ENGLISH errors (A56 — assert literal, do NOT translate)", () => {
  it("save failure shows the literal English 'Failed to save activity area'", async () => {
    wireApi([]);
    apiPost.mockResolvedValue({ data: null, error: "server-boom" });
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("addActivityArea")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("addActivityArea"));
    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "X" },
    });
    fireEvent.change(screen.getByPlaceholderText("codePlaceholder"), {
      target: { value: "X" },
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to save activity area")
      ).toBeInTheDocument();
    });
  });

  it("delete failure shows the literal English 'Failed to delete activity area'", async () => {
    wireApi([AREA]);
    apiDelete.mockResolvedValue({ data: null, error: "server-boom" });
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("delete"));
    fireEvent.click(screen.getByText("confirm"));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to delete activity area")
      ).toBeInTheDocument();
    });
  });

  it("toggle failure shows the literal English 'Failed to toggle activity area status'", async () => {
    wireApi([AREA]);
    apiPut.mockResolvedValue({ data: null, error: "server-boom" });
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("deactivate"));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to toggle activity area status")
      ).toBeInTheDocument();
    });
  });
});

describe("ActivityAreasPage — report tab (AC-4 from/to query, page-local formatCurrency)", () => {
  async function openReport() {
    wireApi([AREA], REPORT_ROWS);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    // The report-tab trigger uses the activityAreas.report → "title" key (tr("title")).
    // It appears as a tab button; click it.
    fireEvent.click(screen.getByText("title", { selector: "button" }));
  }

  it("GETs /activity-areas/report?from=&to= when Filter is clicked", async () => {
    await openReport();
    // The Filter button (activityAreas.report.filter key) triggers the report GET.
    fireEvent.click(screen.getByText("filter"));

    await waitFor(() => {
      expect(
        apiGet.mock.calls.some((c) =>
          /\/api\/v1\/finance\/activity-areas\/report\?from=.+&to=.+/.test(
            String(c[0])
          )
        )
      ).toBe(true);
    });
  });

  it("renders server rows with the page-local de-CH formatCurrency (no symbol)", async () => {
    await openReport();
    fireEvent.click(screen.getByText("filter"));

    await waitFor(() => {
      // 1234.5 → "1’234.50" (apostrophe thousands separator, NO currency symbol).
      // Appears in both the data row income AND the totals footer (single income row).
      expect(screen.getAllByText("1’234.50").length).toBeGreaterThanOrEqual(1);
    });
    // 500 → "500.00" appears (the unassigned row's expense + total income/expense).
    expect(screen.getAllByText("500.00").length).toBeGreaterThanOrEqual(1);
    // Unassigned row uses the report "unassigned" key (null activityAreaCode).
    expect(screen.getByText("unassigned")).toBeInTheDocument();
  });

  it("shows the report noData empty state for an empty report", async () => {
    wireApi([AREA], []);
    render(<ActivityAreasPage />);
    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("title", { selector: "button" }));
    fireEvent.click(screen.getByText("filter"));

    await waitFor(() => {
      expect(screen.getByText("noData")).toBeInTheDocument();
    });
  });
});

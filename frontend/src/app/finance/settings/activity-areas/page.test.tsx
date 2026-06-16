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

// E26-S1 (S6 settings group) — characterization net for the SETTINGS ACTIVITY-AREAS page.
// Behaviour-preservation ORACLE (A87). Pin AS-IS (A56).
//
// Load-bearing pins:
//   - `{items}` GET envelope.
//   - INLINE-confirm delete (two-step in-row confirm/cancel) — NOT a modal (contrast with
//     invoice-templates/tax-codes which use a modal). The confirm button is the tc("confirm") chip.
//   - HARDCODED-ENGLISH error strings (NOT i18n keys): "Failed to load activity areas",
//     "Failed to save activity area", "Failed to delete activity area". Assert literal English; do NOT
//     translate. // A56 note: these are NOT i18n keys — preserve verbatim, S4/S6 decide reconciliation.
//   - save POST/PUT (edit adds `isActive: true` to the payload), POST createSuccess / PUT updateSuccess.
//
// Guard shape pinned: `if (authLoading || loading) return <skeleton>` then `if (!canReadFinance) return null`.
//   `loading` starts true and only flips inside the guarded fetch, so a non-read user is stuck on the
//   skeleton and never reaches `return null` (the fetch never runs).
//   // A56 note: distinct from profile/invoice-templates/tax-codes — this page DOES have the
//   `!canReadFinance` return, but the non-read user never gets past the skeleton anyway. Pinned AS-IS.
//
// A79 deltas: all transport via `useApiClient` direct; no QueryClientProvider (god-page pre-TanStack).

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

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
  isLoading: false,
  canReadFinance: true,
  canWriteFinance: true,
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

import ActivityAreasPage from "./page";

const AREA = {
  id: "area-1",
  name: "Events",
  code: "EVT",
  description: "Event budgets",
  color: "#ea580c",
  isActive: true,
  sortOrder: 0,
};

function wireAreas(items: unknown[]) {
  apiGet.mockResolvedValue({ data: { items }, error: null, status: 200 });
}

beforeEach(() => {
  wireAreas([AREA]);
  apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiPut.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isLoading = false;
  authState.canReadFinance = true;
  authState.canWriteFinance = true;
});

describe("ActivityAreasPage — read/load guard (AC-2)", () => {
  it("shows the skeleton while authLoading and fires no GET", () => {
    authState.isLoading = true;
    const { container } = render(<ActivityAreasPage />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("stays on the skeleton for a non-read user, fires no GET", async () => {
    authState.canReadFinance = false;
    const { container } = render(<ActivityAreasPage />);

    await Promise.resolve();
    expect(apiGet).not.toHaveBeenCalled();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("title")).not.toBeInTheDocument();
  });

  it("loads areas from the {items} envelope via GET /activity-areas", async () => {
    render(<ActivityAreasPage />);

    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/activity-areas");
    expect(screen.getByText("EVT")).toBeInTheDocument();
  });

  it("renders the empty state when items is empty", async () => {
    wireAreas([]);
    render(<ActivityAreasPage />);

    await waitFor(() => {
      expect(screen.getByText("noActivityAreas")).toBeInTheDocument();
    });
  });
});

describe("ActivityAreasPage — hardcoded-English errors (A56, verbatim)", () => {
  it("shows the LITERAL English load error string on GET failure", async () => {
    // The page sets `setError(response.error)` first; for the catch-path literal we exercise a throw.
    apiGet.mockRejectedValue(new Error("network"));
    render(<ActivityAreasPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load activity areas")
      ).toBeInTheDocument();
    });
  });

  it("surfaces res.error verbatim when the GET returns an error field", async () => {
    apiGet.mockResolvedValue({ data: null, error: "boom", status: 500 });
    render(<ActivityAreasPage />);

    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
    });
  });

  it("shows the LITERAL English save error on a failed create", async () => {
    apiPost.mockResolvedValue({ data: null, error: "boom", status: 500 });
    const { container } = render(<ActivityAreasPage />);

    await waitFor(() => {
      expect(screen.getByText("addActivityArea")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("addActivityArea"));
    // Fill required name + code (gate: !form.name || !form.code). Scope to the modal overlay (the
    // page search box is also a text input) — name/code are the first two text inputs in the modal.
    const dialog = container.querySelector(".fixed.inset-0") as HTMLElement;
    const inputs = dialog.querySelectorAll('input[type="text"]');
    fireEvent.change(inputs[0], { target: { value: "Travel" } });
    fireEvent.change(inputs[1], { target: { value: "TRV" } });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to save activity area")
      ).toBeInTheDocument();
    });
  });

  it("shows the LITERAL English delete error on a failed delete", async () => {
    apiDelete.mockResolvedValue({ data: null, error: "boom", status: 500 });
    render(<ActivityAreasPage />);

    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    // Arm the inline confirm, then confirm.
    fireEvent.click(screen.getByTitle("delete"));
    fireEvent.click(screen.getByText("confirm"));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to delete activity area")
      ).toBeInTheDocument();
    });
  });
});

describe("ActivityAreasPage — write guard (AC-3)", () => {
  it("hides add button + row actions for a read-only user", async () => {
    authState.canWriteFinance = false;
    render(<ActivityAreasPage />);

    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    expect(screen.queryByText("addActivityArea")).not.toBeInTheDocument();
    expect(screen.queryByTitle("edit")).not.toBeInTheDocument();
    expect(screen.queryByTitle("delete")).not.toBeInTheDocument();
  });

  it("shows add + per-row edit/delete for a write user", async () => {
    render(<ActivityAreasPage />);

    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    expect(screen.getByText("addActivityArea")).toBeInTheDocument();
    expect(screen.getByTitle("edit")).toBeInTheDocument();
    expect(screen.getByTitle("delete")).toBeInTheDocument();
  });
});

describe("ActivityAreasPage — inline-confirm delete (AC-5)", () => {
  it("delete is a two-step INLINE confirm (not a modal) → DELETE /activity-areas/{id}", async () => {
    render(<ActivityAreasPage />);

    await waitFor(() => {
      expect(screen.getByText("Events")).toBeInTheDocument();
    });
    // First click arms the inline confirm — no DELETE yet, and an inline confirm/cancel pair appears.
    fireEvent.click(screen.getByTitle("delete"));
    expect(apiDelete).not.toHaveBeenCalled();
    expect(screen.getByText("confirm")).toBeInTheDocument();
    // The cancel chip is the common cancel key (no modal title rendered).
    expect(screen.getByText("cancel")).toBeInTheDocument();

    fireEvent.click(screen.getByText("confirm"));
    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/finance/activity-areas/area-1"
      );
    });
  });

  it("cancel disarms the inline confirm without a DELETE", async () => {
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

describe("ActivityAreasPage — create/edit (modal form)", () => {
  it("create POSTs /activity-areas (no isActive in the create payload)", async () => {
    const { container } = render(<ActivityAreasPage />);

    await waitFor(() => {
      expect(screen.getByText("addActivityArea")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("addActivityArea"));
    const dialog = container.querySelector(".fixed.inset-0") as HTMLElement;
    const inputs = dialog.querySelectorAll('input[type="text"]');
    fireEvent.change(inputs[0], { target: { value: "Travel" } });
    fireEvent.change(inputs[1], { target: { value: "TRV" } });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/activity-areas",
        expect.objectContaining({ name: "Travel", code: "TRV" })
      );
    });
    const payload = apiPost.mock.calls[0][1] as Record<string, unknown>;
    // create payload must NOT carry isActive (only edit adds it).
    expect(payload).not.toHaveProperty("isActive");
    // A96: empty optionals → null.
    expect(payload.description).toBeNull();
    expect(payload.color).toBeNull();
  });

  it("edit PUTs /activity-areas/{id} WITH isActive: true in the payload", async () => {
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
        "/api/v1/finance/activity-areas/area-1",
        expect.objectContaining({ name: "Events", code: "EVT", isActive: true })
      );
    });
  });
});

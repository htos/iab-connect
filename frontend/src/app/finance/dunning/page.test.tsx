// @vitest-environment jsdom
//
// E26-S1 (S3) characterization net — dunning page.
//
// A56 note: GUARD = lean canReadFinance ONLY (no isAuthenticated / authLoading).
//   useEffect -> router.replace("/"); render-time `if (!canReadFinance) return null`. CONFIRMED.
// A79 deltas:
//   - Create = modal (opened via openCreate which first GETs overdue+sent invoices to populate
//     the select) -> POST /api/v1/finance/dunning with the form object; refetches on success.
//   - Send (Draft rows only) = POST /dunning/{id}/send then refetch; send link colour =
//     text-orange-600 (dunning send = orange). Pinned.
//   - Save/Send handlers do NOT inspect res.error (they only catch thrown exceptions);
//     saveError surfaced via catch. Pinned.
//   - openCreate GETs invoices?status=Overdue AND invoices?status=Sent (both). Pinned.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/finance/dunning",
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

import Page from "./page";

const notices = [
  {
    id: "dun-draft",
    invoiceId: "inv-1",
    invoiceNumber: "R-001",
    recipientName: "Alice Acme",
    level: 1,
    date: "2026-01-01",
    dueDate: "2026-01-15",
    status: "Draft",
  },
  {
    id: "dun-sent",
    invoiceId: "inv-2",
    invoiceNumber: "R-002",
    recipientName: "Bob Builder",
    level: 2,
    date: "2026-01-02",
    dueDate: "2026-01-16",
    status: "Sent",
  },
];

const overdue = [
  {
    id: "inv-9",
    invoiceNumber: "R-009",
    recipientName: "Overdue Co",
    total: 500,
    dueDate: "2025-12-01",
  },
];
const sent = [
  {
    id: "inv-10",
    invoiceNumber: "R-010",
    recipientName: "Sent Co",
    total: 600,
    dueDate: "2026-01-20",
  },
];

function routeGet(url: string) {
  if (url === "/api/v1/finance/dunning") {
    return Promise.resolve({
      data: { items: notices },
      error: null,
      status: 200,
    });
  }
  if (url === "/api/v1/finance/invoices?status=Overdue") {
    return Promise.resolve({
      data: { items: overdue },
      error: null,
      status: 200,
    });
  }
  if (url === "/api/v1/finance/invoices?status=Sent") {
    return Promise.resolve({ data: { items: sent }, error: null, status: 200 });
  }
  return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
}

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();
  apiGet.mockImplementation((url: string) => routeGet(url));
  apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiPut.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
  apiUpload.mockResolvedValue({ data: {}, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
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

describe("dunning — read guard (lean)", () => {
  it("replaces to / and fires no GET when !canReadFinance", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe("dunning — happy path + endpoint", () => {
  it("GETs /api/v1/finance/dunning and renders the notices", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/dunning");
    expect(screen.getByText("Bob Builder")).toBeInTheDocument();
  });

  it("renders the empty state when there are no notices", async () => {
    apiGet.mockResolvedValue({ data: { items: [] }, error: null, status: 200 });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("noDunningNotices")).toBeInTheDocument()
    );
  });
});

describe("dunning — write-gating", () => {
  it("shows Create + per-row Send (Draft only) when canWriteFinance", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    expect(screen.getByText("createDunning")).toBeInTheDocument();
    // Send only on the Draft notice (1).
    expect(screen.getAllByText("send")).toHaveLength(1);
  });

  it("hides Create + Send + the actions column for read-only", async () => {
    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    expect(screen.queryByText("createDunning")).not.toBeInTheDocument();
    expect(screen.queryByText("send")).not.toBeInTheDocument();
  });
});

describe("dunning — create modal", () => {
  it("openCreate GETs both Overdue and Sent invoices to populate the select", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    fireEvent.click(screen.getByText("createDunning"));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        "/api/v1/finance/invoices?status=Overdue"
      )
    );
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/invoices?status=Sent");
  });

  it("POSTs /api/v1/finance/dunning with the form after selecting an invoice", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    fireEvent.click(screen.getByText("createDunning"));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        "/api/v1/finance/invoices?status=Overdue"
      )
    );
    const invoiceSelect = screen.getAllByRole(
      "combobox"
    )[0] as HTMLSelectElement;
    fireEvent.change(invoiceSelect, { target: { value: "inv-9" } });
    fireEvent.click(screen.getByText("save"));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/dunning",
        expect.objectContaining({ invoiceId: "inv-9" })
      )
    );
  });
});

describe("dunning — send (orange affordance)", () => {
  it("send link is orange; POSTs /dunning/{id}/send and refetches", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    const sendBtn = screen.getByText("send");
    expect(sendBtn.className).toContain("text-orange-600");
    const getsBefore = apiGet.mock.calls.filter(
      (c) => c[0] === "/api/v1/finance/dunning"
    ).length;
    fireEvent.click(sendBtn);
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/dunning/dun-draft/send",
        {}
      )
    );
    await waitFor(() =>
      expect(
        apiGet.mock.calls.filter((c) => c[0] === "/api/v1/finance/dunning")
          .length
      ).toBeGreaterThan(getsBefore)
    );
  });
});

describe("dunning — load error", () => {
  it("shows loadError when the GET throws (res.error path)", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/dunning") {
        return Promise.resolve({ data: null, error: "boom", status: 500 });
      }
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("loadError")).toBeInTheDocument()
    );
  });
});

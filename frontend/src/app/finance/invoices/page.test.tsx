// @vitest-environment jsdom
//
// E26-S1 (S3 receivables/payables) characterization net — invoices LIST page.
// Behaviour-preservation ORACLE; pins CURRENT (god-page) observable behaviour AS-IS.
//
// A56 note: GUARD = canonical (isAuthenticated + authLoading; router.push("/");
//   spinner while authLoading -> if (!isAuthenticated||!canReadFinance) return null). CONFIRMED.
// A79 deltas:
//   - A100: optimistic LOCAL status patch with NO refetch. Send -> status "Sent",
//     Cancel -> status "Cancelled", both mutate `invoices` in place; no re-GET.
//     `actionLoading` is per-id; on res.error the local list is left UNCHANGED.
//   - Endpoint divergence: list Cancel fires DELETE /api/v1/finance/invoices/{id}
//     (vs detail page POST /invoices/{id}/cancel). Pinned here.
//   - Affordances: send = blue icon + orange confirm button; cancel = red icon +
//     red confirm button. Both via a modal (two-step). Pinned.
//   - Server filters: status/from/to appended as query params; search is client-side.
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

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/finance",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    title,
  }: {
    children: React.ReactNode;
    href?: string;
    title?: string;
  }) => (
    <a href={typeof href === "string" ? href : "#"} title={title}>
      {children}
    </a>
  ),
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

const invoices = [
  {
    id: "inv-draft",
    invoiceNumber: "R-001",
    date: "2026-01-01",
    dueDate: "2026-02-01",
    recipientName: "Alice Acme",
    recipientType: "External",
    subTotal: 100,
    taxRate: 0,
    taxAmount: 0,
    total: 100,
    status: "Draft",
  },
  {
    id: "inv-sent",
    invoiceNumber: "R-002",
    date: "2026-01-05",
    dueDate: "2026-02-05",
    recipientName: "Bob Builder",
    recipientType: "Member",
    subTotal: 200,
    taxRate: 0,
    taxAmount: 0,
    total: 200,
    status: "Sent",
  },
  {
    id: "inv-paid",
    invoiceNumber: "R-003",
    date: "2026-01-10",
    dueDate: "2026-02-10",
    recipientName: "Carol Corp",
    recipientType: "External",
    subTotal: 300,
    taxRate: 0,
    taxAmount: 0,
    total: 300,
    status: "Paid",
  },
];

function routeGet(url: string) {
  if (url.startsWith("/api/v1/finance/invoices")) {
    return Promise.resolve({
      data: { items: invoices },
      error: null,
      status: 200,
    });
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

describe("invoices list — read guard (canonical)", () => {
  it("redirects to / and renders null when not authenticated", async () => {
    authState.isAuthenticated = false;
    render(<Page />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(screen.queryByText("invoices")).not.toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects to / and fires no GET when !canReadFinance", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("shows the spinner (no redirect, no null) while authLoading", () => {
    authState.isLoading = true;
    const { container } = render(<Page />);
    expect(push).not.toHaveBeenCalled();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

describe("invoices list — happy path + endpoint", () => {
  it("GETs /api/v1/finance/invoices (no query when no filters) and renders rows", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/invoices");
    expect(screen.getByText("Alice Acme")).toBeInTheDocument();
    expect(screen.getByText("Bob Builder")).toBeInTheDocument();
  });

  it("appends status filter as a query param", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("allStatuses"), {
      target: { value: "Draft" },
    });
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        "/api/v1/finance/invoices?status=Draft"
      )
    );
  });

  it("filters client-side via the search box (no extra GET)", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    const before = apiGet.mock.calls.length;
    fireEvent.change(screen.getByPlaceholderText("invoicesSearchPlaceholder"), {
      target: { value: "Alice" },
    });
    expect(screen.getByText("Alice Acme")).toBeInTheDocument();
    expect(screen.queryByText("Bob Builder")).not.toBeInTheDocument();
    expect(apiGet.mock.calls.length).toBe(before);
  });

  it("renders the empty state when no invoices", async () => {
    apiGet.mockResolvedValue({ data: { items: [] }, error: null, status: 200 });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("noInvoices")).toBeInTheDocument()
    );
  });
});

describe("invoices list — write-gating (canWriteFinance)", () => {
  it("shows the New-invoice link + per-row Send (Draft) + Cancel (non Paid/Cancelled) when canWriteFinance", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    // New invoice link
    const newLink = screen.getByText("newInvoice").closest("a");
    expect(newLink).toHaveAttribute("href", "/finance/invoices/new");
    // Send only on the Draft row
    expect(screen.getAllByTitle("send")).toHaveLength(1);
    // Cancel on Draft + Sent (not Paid) = 2
    expect(screen.getAllByTitle("cancelled")).toHaveLength(2);
  });

  it("hides New + Send + Cancel for a read-only user", async () => {
    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    expect(screen.queryByText("newInvoice")).not.toBeInTheDocument();
    expect(screen.queryByTitle("send")).not.toBeInTheDocument();
    expect(screen.queryByTitle("cancelled")).not.toBeInTheDocument();
  });
});

describe("invoices list — Send (blue icon + orange confirm; optimistic local patch A100)", () => {
  it("send icon is blue; opens a confirm modal then POSTs /send and patches status locally with NO refetch", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    const sendBtn = screen.getByTitle("send");
    expect(sendBtn.className).toContain("text-blue-500");
    fireEvent.click(sendBtn);

    // Modal opens (two-step). Confirm button is orange.
    const confirmBtn = screen
      .getByText("confirmSend")
      .closest("div")!.parentElement!;
    void confirmBtn;
    const sendConfirm = screen
      .getAllByText("send")
      .find((el) => el.tagName === "BUTTON")!;
    expect(sendConfirm.className).toContain("bg-orange-600");

    const getsBefore = apiGet.mock.calls.length;
    fireEvent.click(sendConfirm);
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/invoices/inv-draft/send",
        {}
      )
    );
    // Optimistic patch: the formerly-Draft row's status badge now reads "sent" (status
    // badge is a <span>, distinct from the filter <option> that also reads "sent");
    // no refetch GET fired.
    await waitFor(() =>
      expect(
        screen.getAllByText("sent").filter((el) => el.tagName === "SPAN")
      ).toHaveLength(2)
    );
    expect(apiGet.mock.calls.length).toBe(getsBefore);
  });

  it("leaves the local list unchanged on a Send error (no-change-on-error)", async () => {
    apiPost.mockResolvedValue({ data: null, error: "boom", status: 500 });
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("send"));
    const sendConfirm = screen
      .getAllByText("send")
      .find((el) => el.tagName === "BUTTON")!;
    fireEvent.click(sendConfirm);
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
    // The Draft row keeps its draft status badge (status NOT patched on error).
    // The status badge is a <span> (distinct from the filter <option> reading "draft").
    expect(
      screen.getAllByText("draft").filter((el) => el.tagName === "SPAN")
    ).toHaveLength(1);
  });
});

describe("invoices list — Cancel (red icon + red confirm; DELETE endpoint; A100 patch)", () => {
  it("cancel icon is red; confirm DELETEs /invoices/{id} (NOT POST /cancel) and patches status to Cancelled locally with NO refetch", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    const cancelIcons = screen.getAllByTitle("cancelled");
    expect(cancelIcons[0].className).toContain("text-red-500");
    fireEvent.click(cancelIcons[0]); // Draft row

    const cancelConfirm = screen
      .getAllByText("confirmCancel")
      .find((el) => el.tagName === "BUTTON")!;
    expect(cancelConfirm.className).toContain("bg-red-600");

    const getsBefore = apiGet.mock.calls.length;
    fireEvent.click(cancelConfirm);
    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/finance/invoices/inv-draft"
      )
    );
    // Divergence pin: list cancel uses DELETE, not POST /cancel.
    expect(apiPost).not.toHaveBeenCalledWith(
      "/api/v1/finance/invoices/inv-draft/cancel",
      expect.anything()
    );
    await waitFor(() =>
      expect(screen.getAllByText("cancelled").length).toBeGreaterThan(0)
    );
    expect(apiGet.mock.calls.length).toBe(getsBefore);
  });
});

describe("invoices list — error banner on load failure", () => {
  it("shows the server error string when the GET fails", async () => {
    apiGet.mockResolvedValue({ data: null, error: "load-fail", status: 500 });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("load-fail")).toBeInTheDocument()
    );
  });
});

describe("invoices list — view link", () => {
  it("links each row to its detail route", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    const viewLinks = screen.getAllByTitle("view");
    expect(viewLinks[0].closest("a")).toHaveAttribute(
      "href",
      "/finance/invoices/inv-draft"
    );
    void within;
  });
});

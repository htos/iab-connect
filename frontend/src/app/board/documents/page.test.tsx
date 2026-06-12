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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * E29-S1: Characterization tests for the Board Documents LIST page (REQ-034/035).
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/board/documents/page.tsx` BEFORE the E29-S3 feature-slice
 * refactor. The god-page uses `@/lib/services/documents` (ApiResult
 * {success,data,error}) for the data + status/delete actions, raw `fetch` +
 * dynamic `next-auth/react getSession()` for the upload FormData, and a
 * `window.confirm`-free in-component modal for delete confirmation.
 *
 * DEC-1 layer-matched hybrid mocks (the surface S3 will re-point):
 *   - vi.mock("@/lib/services/documents") for getDocuments/getFolders/getAllTags
 *     + review/publish/archive/deleteDocument (mutated per-test).
 *   - vi.mock("@/lib/auth") for a STABLE useAuth (A64/A78 — define once, mutate
 *     isAuthenticated/isVorstand/isAdmin/isLoading per test).
 *   - vi.stubGlobal("fetch", …) for the raw-fetch upload (FormData).
 *   - vi.unstubAllGlobals() in afterEach.
 *
 * Assert via i18n KEYS (identity translator), ARIA roles, service-fn call args,
 * fetch URLs and navigation — never display copy (AC-11). Delete/upload/status
 * assertions are at the OUTCOME level (service fn fires → refetch / failure
 * surfaced) so the S3 slice refactor keeps them green.
 */

// next-intl: one captured (stable) identity translator (A64).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// next/navigation: stable router so push() is assertable.
const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

// next-auth/react: stable getSession (the upload path dynamically imports it
// for the Bearer token).
const getSession = vi.fn(() => Promise.resolve({ accessToken: "tok-123" }));
vi.mock("next-auth/react", () => ({
  getSession: () => getSession(),
}));

// @/lib/services/documents: mock the data + action fns; keep the pure helpers
// + enums real (importActual) so DocumentStatus/DocumentCategory/formatFileSize/
// getStatusColor behave as at HEAD.
const getDocuments = vi.fn();
const getFolders = vi.fn();
const getAllTags = vi.fn();
const deleteDocument = vi.fn();
const reviewDocument = vi.fn();
const publishDocument = vi.fn();
const archiveDocument = vi.fn();
vi.mock("@/lib/services/documents", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/documents")
  >("@/lib/services/documents");
  return {
    ...actual,
    getDocuments: (...args: unknown[]) => getDocuments(...args),
    getFolders: (...args: unknown[]) => getFolders(...args),
    getAllTags: (...args: unknown[]) => getAllTags(...args),
    deleteDocument: (...args: unknown[]) => deleteDocument(...args),
    reviewDocument: (...args: unknown[]) => reviewDocument(...args),
    publishDocument: (...args: unknown[]) => publishDocument(...args),
    archiveDocument: (...args: unknown[]) => archiveDocument(...args),
  };
});

// @/lib/auth: configurable, STABLE auth state (A64/A78).
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isVorstand: true,
  isAdmin: false,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

import BoardDocumentsPage from "./page";

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    name: "Statutes",
    description: "Club statutes",
    category: "General",
    status: "Draft",
    folderId: "folder-1",
    contentType: "application/pdf",
    fileSize: 1024,
    tags: ["legal"],
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeFolder(overrides: Record<string, unknown> = {}) {
  return {
    id: "folder-1",
    name: "Protocols",
    sortOrder: 0,
    permissions: [],
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// Per-test overrides.
let documentsPayload: {
  items: ReturnType<typeof makeDoc>[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
let documentsOk: boolean;
let documentsReject: boolean;
let foldersPayload: ReturnType<typeof makeFolder>[];

function getDocumentsCalls() {
  return getDocuments.mock.calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = true;
  authState.isAdmin = false;

  documentsPayload = {
    items: [makeDoc()],
    totalCount: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };
  documentsOk = true;
  documentsReject = false;
  foldersPayload = [];

  getDocuments.mockImplementation(() => {
    if (documentsReject) return Promise.reject(new Error("boom"));
    return documentsOk
      ? Promise.resolve({ success: true, data: documentsPayload })
      : Promise.resolve({ success: false, data: null, error: "load failed" });
  });
  getAllTags.mockResolvedValue({ success: true, data: ["legal", "finance"] });
  getFolders.mockImplementation(() =>
    Promise.resolve({ success: true, data: foldersPayload })
  );
  deleteDocument.mockResolvedValue({ success: true, data: null });
  reviewDocument.mockResolvedValue({ success: true, data: null });
  publishDocument.mockResolvedValue({ success: true, data: null });
  archiveDocument.mockResolvedValue({ success: true, data: null });

  // Raw-fetch upload path (FormData). Default OK.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BoardDocumentsPage />
    </QueryClientProvider>
  );
}

describe("BoardDocumentsPage — characterization (current behaviour)", () => {
  // --- AC-2/AC-3: auth guard (Vorstand OR Admin only) ---

  it("redirects an unauthenticated user to / and fires no list fetch", async () => {
    authState.isAuthenticated = false;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getDocuments).not.toHaveBeenCalled();
  });

  it("redirects an authenticated Member-only user to / and fires no list fetch", async () => {
    authState.isAuthenticated = true;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getDocuments).not.toHaveBeenCalled();
  });

  it("shows the auth spinner while auth is still loading and does not redirect", () => {
    authState.isLoading = true;

    const { container } = renderPage();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    // The role gate is suppressed while authLoading (page.tsx:62) — no redirect.
    expect(push).not.toHaveBeenCalled();
  });

  it("loads the list for a Vorstand-only user", async () => {
    renderPage();

    await waitFor(() => expect(getDocuments).toHaveBeenCalled());
    expect(await screen.findByText("Statutes")).toBeInTheDocument();
  });

  it("loads the list for an Admin-only user", async () => {
    authState.isVorstand = false;
    authState.isAdmin = true;

    renderPage();

    await waitFor(() => expect(getDocuments).toHaveBeenCalled());
    expect(await screen.findByText("Statutes")).toBeInTheDocument();
  });

  // --- AC-5: list load + initial query args ---

  it("requests the first page with page=1 and pageSize=20", async () => {
    renderPage();

    await waitFor(() => expect(getDocuments).toHaveBeenCalled());
    const args = getDocumentsCalls()[0][0] as Record<string, unknown>;
    expect(args.page).toBe(1);
    expect(args.pageSize).toBe(20);
  });

  it("also loads the tag list in parallel", async () => {
    renderPage();

    await waitFor(() => expect(getAllTags).toHaveBeenCalled());
  });

  // --- AC-3: status-action + delete affordances by role ---

  it("renders the status-action buttons + Delete for a Draft document", async () => {
    renderPage();
    await screen.findByText("Statutes");

    expect(
      screen.getByRole("button", { name: "documents.markReviewed" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "documents.publish" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "common.delete" })
    ).toBeInTheDocument();
  });

  it("shows only Publish + Archive (no Mark-Reviewed) for a Reviewed document", async () => {
    documentsPayload.items = [makeDoc({ status: "Reviewed" })];

    renderPage();
    await screen.findByText("Statutes");

    expect(
      screen.queryByRole("button", { name: "documents.markReviewed" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "documents.publish" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "documents.archive" })
    ).toBeInTheDocument();
  });

  it("shows only Archive for a Published document", async () => {
    documentsPayload.items = [makeDoc({ status: "Published" })];

    renderPage();
    await screen.findByText("Statutes");

    expect(
      screen.queryByRole("button", { name: "documents.markReviewed" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "documents.publish" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "documents.archive" })
    ).toBeInTheDocument();
  });

  // --- AC-5: filters each reset page → 1 ---

  it("typing in search resets page→1 and refetches with search=", async () => {
    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentsCalls().length;

    fireEvent.change(
      screen.getByPlaceholderText("documents.searchPlaceholder"),
      { target: { value: "report" } }
    );

    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
    const args = getDocumentsCalls().at(-1)![0] as Record<string, unknown>;
    expect(args.search).toBe("report");
    expect(args.page).toBe(1);
  });

  it("changing the status filter resets page→1 and refetches with status=", async () => {
    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentsCalls().length;

    // first combobox = status filter, second = category filter
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "Published" } });

    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
    const args = getDocumentsCalls().at(-1)![0] as Record<string, unknown>;
    expect(args.status).toBe("Published");
    expect(args.page).toBe(1);
  });

  it("changing the category filter resets page→1 and refetches with category=", async () => {
    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentsCalls().length;

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "Protocol" } });

    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
    const args = getDocumentsCalls().at(-1)![0] as Record<string, unknown>;
    expect(args.category).toBe("Protocol");
    expect(args.page).toBe(1);
  });

  // --- AC-5: folder navigation + breadcrumb ---

  it("navigating into a folder refetches with that folderId and page=1", async () => {
    foldersPayload = [makeFolder()];

    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentsCalls().length;

    // folder grid button (label = folder name)
    fireEvent.click(screen.getByRole("button", { name: "Protocols" }));

    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
    const args = getDocumentsCalls().at(-1)![0] as Record<string, unknown>;
    expect(args.folderId).toBe("folder-1");
    expect(args.page).toBe(1);
  });

  it("the Root breadcrumb clears the selected folder and refetches without folderId", async () => {
    foldersPayload = [makeFolder()];

    renderPage();
    await screen.findByText("Statutes");

    // navigate in first
    fireEvent.click(screen.getByRole("button", { name: "Protocols" }));
    await waitFor(() =>
      expect(
        (getDocumentsCalls().at(-1)![0] as Record<string, unknown>).folderId
      ).toBe("folder-1")
    );
    const before = getDocumentsCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "documents.root" }));

    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
    const args = getDocumentsCalls().at(-1)![0] as Record<string, unknown>;
    expect(args.folderId).toBeUndefined();
    expect(args.page).toBe(1);
  });

  // --- AC-5: upload modal (FormData + raw fetch) ---

  it("the upload button is disabled when no folder is selected", async () => {
    renderPage();
    await screen.findByText("Statutes");

    expect(
      screen.getByRole("button", { name: "documents.upload" })
    ).toBeDisabled();
  });

  it("the upload button is enabled once a folder is selected", async () => {
    foldersPayload = [makeFolder()];

    renderPage();
    await screen.findByText("Statutes");
    fireEvent.click(screen.getByRole("button", { name: "Protocols" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "documents.upload" })
      ).toBeEnabled()
    );
  });

  it("uploads via FormData to POST /api/v1/documents then resets + refetches on success", async () => {
    foldersPayload = [makeFolder()];

    renderPage();
    await screen.findByText("Statutes");
    fireEvent.click(screen.getByRole("button", { name: "Protocols" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "documents.upload" })
      ).toBeEnabled()
    );

    // open modal
    fireEvent.click(screen.getByRole("button", { name: "documents.upload" }));
    expect(
      await screen.findByText("documents.uploadDocument")
    ).toBeInTheDocument();

    // choose a file
    const file = new File(["x"], "policy.pdf", { type: "application/pdf" });
    const fileInput = document.querySelector('input[type="file"]')!;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const before = getDocumentsCalls().length;
    // submit (the modal's upload button is the last enabled one)
    const uploadButtons = screen.getAllByRole("button", {
      name: "documents.upload",
    });
    fireEvent.click(uploadButtons[uploadButtons.length - 1]);

    await waitFor(() => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      expect(fetchMock).toHaveBeenCalled();
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/documents");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("folderId")).toBe("folder-1");
    expect((init.body as FormData).get("file")).toBe(file);

    // success → modal closes + refetch
    await waitFor(() =>
      expect(
        screen.queryByText("documents.uploadDocument")
      ).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
    expect(
      await screen.findByText("documents.uploadSuccess")
    ).toBeInTheDocument();
  });

  it("surfaces documents.uploadError when the upload fetch is not ok", async () => {
    foldersPayload = [makeFolder()];
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      )
    );

    renderPage();
    await screen.findByText("Statutes");
    fireEvent.click(screen.getByRole("button", { name: "Protocols" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "documents.upload" })
      ).toBeEnabled()
    );

    fireEvent.click(screen.getByRole("button", { name: "documents.upload" }));
    await screen.findByText("documents.uploadDocument");
    const file = new File(["x"], "policy.pdf", { type: "application/pdf" });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    const uploadButtons = screen.getAllByRole("button", {
      name: "documents.upload",
    });
    fireEvent.click(uploadButtons[uploadButtons.length - 1]);

    expect(
      await screen.findByText("documents.uploadError")
    ).toBeInTheDocument();
  });

  // --- AC-5: status-change actions → service fn + refetch / error ---

  it("Mark-Reviewed calls reviewDocument then refetches and shows statusChanged", async () => {
    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentsCalls().length;

    fireEvent.click(
      screen.getByRole("button", { name: "documents.markReviewed" })
    );

    await waitFor(() => expect(reviewDocument).toHaveBeenCalledWith("doc-1"));
    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
    expect(
      await screen.findByText("documents.statusChanged")
    ).toBeInTheDocument();
  });

  it("Publish calls publishDocument and refetches", async () => {
    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentsCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "documents.publish" }));

    await waitFor(() => expect(publishDocument).toHaveBeenCalledWith("doc-1"));
    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
  });

  it("Archive calls archiveDocument and refetches", async () => {
    documentsPayload.items = [makeDoc({ status: "Published" })];

    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentsCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "documents.archive" }));

    await waitFor(() => expect(archiveDocument).toHaveBeenCalledWith("doc-1"));
    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
  });

  it("surfaces documents.statusChangeError when a status action fails", async () => {
    reviewDocument.mockResolvedValue({
      success: false,
      data: null,
      error: undefined,
    });

    renderPage();
    await screen.findByText("Statutes");

    fireEvent.click(
      screen.getByRole("button", { name: "documents.markReviewed" })
    );

    expect(
      await screen.findByText("documents.statusChangeError")
    ).toBeInTheDocument();
  });

  // --- AC-5: delete via confirm modal → deleteDocument → refetch / error ---

  it("opens the delete modal and deletes via deleteDocument then refetches", async () => {
    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentsCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    expect(
      await screen.findByText("documents.confirmDeleteTitle")
    ).toBeInTheDocument();

    // confirm: the modal's delete button is the last "common.delete"
    const deleteButtons = screen.getAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith("doc-1"));
    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
    expect(
      await screen.findByText("documents.deleteSuccess")
    ).toBeInTheDocument();
  });

  it("does not call deleteDocument when the delete modal is cancelled", async () => {
    renderPage();
    await screen.findByText("Statutes");

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    await screen.findByText("documents.confirmDeleteTitle");
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    await waitFor(() =>
      expect(
        screen.queryByText("documents.confirmDeleteTitle")
      ).not.toBeInTheDocument()
    );
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("surfaces documents.deleteError when the delete fails", async () => {
    deleteDocument.mockResolvedValue({
      success: false,
      data: null,
      error: undefined,
    });

    renderPage();
    await screen.findByText("Statutes");

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    await screen.findByText("documents.confirmDeleteTitle");
    const deleteButtons = screen.getAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    expect(
      await screen.findByText("documents.deleteError")
    ).toBeInTheDocument();
  });

  // --- AC-5: row → detail navigation ---

  it("clicking the Details action navigates to /board/documents/{id}", async () => {
    renderPage();
    await screen.findByText("Statutes");

    fireEvent.click(screen.getByRole("button", { name: "common.details" }));

    expect(push).toHaveBeenCalledWith("/board/documents/doc-1");
  });

  // --- AC-5: pagination ---

  it("does not render pagination when totalPages === 1", async () => {
    renderPage();
    await screen.findByText("Statutes");

    expect(
      screen.queryByRole("button", { name: "common.previous" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "common.next" })
    ).not.toBeInTheDocument();
  });

  it("disables Prev at page 1 and enables Next when totalPages > 1", async () => {
    documentsPayload.totalPages = 3;
    documentsPayload.totalCount = 50;

    renderPage();
    await screen.findByText("Statutes");

    expect(
      screen.getByRole("button", { name: "common.previous" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "common.next" })).toBeEnabled();
  });

  it("clicking Next refetches with the incremented page", async () => {
    documentsPayload.totalPages = 3;
    documentsPayload.totalCount = 50;

    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentsCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "common.next" }));

    await waitFor(() =>
      expect(getDocumentsCalls().length).toBeGreaterThan(before)
    );
    const args = getDocumentsCalls().at(-1)![0] as Record<string, unknown>;
    expect(args.page).toBe(2);
  });

  // --- AC-9: loading / empty / loadError lifecycle ---

  it("renders the loading spinner while the list load is pending", async () => {
    getDocuments.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() => expect(getDocuments).toHaveBeenCalled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders the empty state when no documents are returned", async () => {
    documentsPayload.items = [];
    documentsPayload.totalCount = 0;

    renderPage();

    expect(
      await screen.findByText("documents.noDocuments")
    ).toBeInTheDocument();
  });

  it("surfaces documents.loadError when the list load rejects", async () => {
    documentsReject = true;

    renderPage();

    expect(await screen.findByText("documents.loadError")).toBeInTheDocument();
  });
});

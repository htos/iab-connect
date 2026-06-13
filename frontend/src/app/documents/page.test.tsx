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
 * E29-S1: Characterization tests for the member Documents browser
 * (REQ-034 — `frontend/src/app/documents/page.tsx`).
 *
 * Pins the CURRENT observable behaviour at HEAD BEFORE the E29-S2 feature-slice
 * extraction. The page is a manual-`useState` god-page that calls
 * `documents` (getDocuments/getFolders/getAllTags) for data, a
 * raw `fetch` for the authenticated blob download (dynamic `getSession()` token),
 * and `@/lib/auth` `useAuth` for the (role-less) auth guard.
 *
 * DEC-1 layer-matched hybrid mocks:
 *   - `vi.mock("@/features/documents/api/documents-transport")` — the 3 data fns
 *     are vi.fn; `getDownloadUrl` is spied via `vi.mock("@/types/documents",
 *     importActual)` (the other helpers, e.g. formatFileSize, stay real).
 *   - `vi.mock("@/lib/auth")` — stable `useAuth` (mutate isAuthenticated/
 *     isLoading per test; the page reads NO role flags — no role gate).
 *   - `vi.stubGlobal("fetch")` — ONLY the blob download; `URL.createObjectURL`/
 *     `revokeObjectURL` stubbed (jsdom lacks them).
 *
 * Asserts via i18n KEYS (identity translator), ARIA roles, service-fn call args,
 * fetch URLs, and navigation — never display copy — so the suite survives S2.
 * A64/A78: mocked hooks return STABLE references (define once, mutate fields).
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

// @/lib/auth: configurable, STABLE auth state. The page reads only
// isAuthenticated + isLoading (NO role gate — every authenticated user may
// browse, REQ-034).
const authState = {
  isAuthenticated: true,
  isLoading: false,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

// Transport data fns are vi.fn (the surface S2 re-points); the `getDownloadUrl`
// helper is also spied here and now lives in `@/types/documents` (E31-S1), where
// the remaining helpers (formatFileSize) stay real via importActual. `vi.hoisted`
// makes the fns available to the hoisted `vi.mock` factories below (A64/A78 —
// stable refs).
const { getDocuments, getFolders, getAllTags, getDownloadUrl } = vi.hoisted(
  () => ({
    getDocuments: vi.fn(),
    getFolders: vi.fn(),
    getAllTags: vi.fn(),
    getDownloadUrl: vi.fn(),
  })
);
vi.mock("@/features/documents/api/documents-transport", () => ({
  getDocuments,
  getFolders,
  getAllTags,
}));
vi.mock("@/types/documents", async (importActual) => {
  const actual = await importActual<typeof import("@/types/documents")>();
  return {
    ...actual,
    getDownloadUrl,
  };
});

import DocumentsPage from "./page";

const FOLDER_A = {
  id: "folder-a",
  name: "Folder A",
  description: undefined,
  parentFolderId: undefined,
  sortOrder: 0,
  permissions: [],
  createdAt: "2026-01-01T00:00:00Z",
};
const FOLDER_B = {
  id: "folder-b",
  name: "Folder B",
  description: undefined,
  parentFolderId: undefined,
  sortOrder: 1,
  permissions: [],
  createdAt: "2026-01-01T00:00:00Z",
};

const DOC_1 = {
  id: "doc-1",
  name: "Annual Report.pdf",
  description: undefined,
  category: "Report",
  status: "Published",
  folderId: "folder-a",
  contentType: "application/pdf",
  fileSize: 2048,
  tags: ["finance", "2026"],
  createdAt: "2026-03-15T00:00:00Z",
};

// Per-test overrides for the getDocuments mock payload/outcome.
let docsPayload: {
  items: (typeof DOC_1)[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
let docsReject: boolean;
let foldersData: (typeof FOLDER_A)[];

function configureMocks() {
  getDocuments.mockImplementation(() =>
    docsReject
      ? Promise.reject(new Error("boom"))
      : Promise.resolve({ success: true, data: docsPayload })
  );
  getFolders.mockResolvedValue({ success: true, data: foldersData });
  getAllTags.mockResolvedValue({ success: true, data: ["finance", "2026"] });
  getDownloadUrl.mockImplementation(
    (id: string) => `http://localhost:5000/api/v1/documents/${id}/download`
  );
}

// The first positional arg of each getDocuments call (the params object).
function docCalls() {
  return getDocuments.mock.calls.map((c) => c[0] as Record<string, unknown>);
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;

  docsPayload = {
    items: [DOC_1],
    totalCount: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };
  docsReject = false;
  foldersData = [FOLDER_A, FOLDER_B];

  configureMocks();

  // jsdom lacks the object-URL helpers the download path touches.
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    })
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
      <DocumentsPage />
    </QueryClientProvider>
  );
}

describe("DocumentsPage — characterization (current behaviour at HEAD)", () => {
  // ---- Auth guard (page.tsx:40-44 + 134-143) ----

  it("shows a centred spinner while auth is loading and does not fetch", async () => {
    authState.isLoading = true;
    authState.isAuthenticated = false;

    const { container } = renderPage();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(getDocuments).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login and does not fetch", async () => {
    authState.isAuthenticated = false;
    authState.isLoading = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(getDocuments).not.toHaveBeenCalled();
    expect(getFolders).not.toHaveBeenCalled();
  });

  it("does not fetch before auth settles (loading, not yet authenticated)", async () => {
    authState.isLoading = true;
    authState.isAuthenticated = false;

    renderPage();

    // No redirect while loading, and no data fetch.
    expect(push).not.toHaveBeenCalled();
    expect(getDocuments).not.toHaveBeenCalled();
  });

  // ---- Initial load + params (page.tsx:46-74) ----

  it("loads documents for an authenticated user and renders a row", async () => {
    renderPage();

    await waitFor(() => expect(getDocuments).toHaveBeenCalled());
    expect(await screen.findByText("Annual Report.pdf")).toBeInTheDocument();
  });

  it("requests the initial page with page=1 and pageSize=20", async () => {
    renderPage();

    await waitFor(() => expect(docCalls().length).toBeGreaterThan(0));
    expect(docCalls()[0]).toMatchObject({ page: 1, pageSize: 20 });
  });

  it("passes undefined for search/folderId/tags on the initial (unfiltered) load", async () => {
    renderPage();

    await waitFor(() => expect(docCalls().length).toBeGreaterThan(0));
    expect(docCalls()[0]).toMatchObject({
      search: undefined,
      folderId: undefined,
      tags: undefined,
    });
  });

  it("loads tags in parallel via getAllTags on initial load", async () => {
    renderPage();

    await waitFor(() => expect(getAllTags).toHaveBeenCalled());
    // The loaded tags populate the filter <option>s.
    await screen.findByText("Annual Report.pdf");
    expect(screen.getByRole("option", { name: "finance" })).toBeInTheDocument();
  });

  it("loads the root folders via getFolders(undefined) on initial load", async () => {
    renderPage();

    await waitFor(() => expect(getFolders).toHaveBeenCalled());
    expect(getFolders).toHaveBeenCalledWith(undefined);
    expect(await screen.findByText("Folder A")).toBeInTheDocument();
    expect(screen.getByText("Folder B")).toBeInTheDocument();
  });

  // ---- Search / filters (page.tsx:189-218) ----

  it("typing in search refetches with the search term and resets page to 1", async () => {
    docsPayload.totalPages = 3;
    docsPayload.totalCount = 50;

    renderPage();
    await screen.findByText("Annual Report.pdf");

    // advance off page 1 first so the reset is observable
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    await waitFor(() =>
      expect(docCalls().some((c) => c.page === 2)).toBe(true)
    );
    const before = docCalls().length;

    fireEvent.change(
      screen.getByPlaceholderText("documents.searchPlaceholder"),
      { target: { value: "report" } }
    );

    await waitFor(() => expect(docCalls().length).toBeGreaterThan(before));
    const last = docCalls().at(-1)!;
    expect(last).toMatchObject({ search: "report", page: 1 });
  });

  it("selecting a tag refetches with a single-tags STRING (not array) and page=1", async () => {
    renderPage();
    await screen.findByText("Annual Report.pdf");
    const before = docCalls().length;

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "finance" },
    });

    await waitFor(() => expect(docCalls().length).toBeGreaterThan(before));
    const last = docCalls().at(-1)!;
    expect(last.tags).toBe("finance");
    expect(Array.isArray(last.tags)).toBe(false);
    expect(last).toMatchObject({ page: 1 });
  });

  // ---- Folder navigation + breadcrumb (page.tsx:90-110, 159-186, 228-275) ----

  it("does NOT render the up-button at root (currentPath.length === 0)", async () => {
    renderPage();
    await screen.findByText("Folder A");

    // ".." is the up-button label
    expect(screen.queryByText("..")).not.toBeInTheDocument();
  });

  it("navigating into a folder filters getDocuments by folderId and shows the up-button", async () => {
    renderPage();
    await screen.findByText("Folder A");
    const before = docCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "Folder A" }));

    await waitFor(() => expect(docCalls().length).toBeGreaterThan(before));
    expect(docCalls().at(-1)).toMatchObject({
      folderId: "folder-a",
      page: 1,
    });
    // breadcrumb shows the current folder (text-only, last item) + up-button
    expect(await screen.findByText("..")).toBeInTheDocument();
  });

  it("the breadcrumb root button navigates back to root (folderId undefined)", async () => {
    renderPage();
    await screen.findByText("Folder A");

    fireEvent.click(screen.getByRole("button", { name: "Folder A" }));
    await waitFor(() =>
      expect(docCalls().some((c) => c.folderId === "folder-a")).toBe(true)
    );
    const before = docCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "documents.root" }));

    await waitFor(() => expect(docCalls().length).toBeGreaterThan(before));
    expect(docCalls().at(-1)).toMatchObject({
      folderId: undefined,
      page: 1,
    });
  });

  it("the up-button navigates up one level (back to root from depth 1)", async () => {
    renderPage();
    await screen.findByText("Folder A");

    fireEvent.click(screen.getByRole("button", { name: "Folder A" }));
    await screen.findByText("..");
    const before = docCalls().length;

    fireEvent.click(screen.getByText(".."));

    await waitFor(() => expect(docCalls().length).toBeGreaterThan(before));
    expect(docCalls().at(-1)).toMatchObject({ folderId: undefined });
  });

  // ---- Loading / empty / error lifecycle ----

  it("renders the empty state when no documents are returned", async () => {
    docsPayload.items = [];
    docsPayload.totalCount = 0;

    renderPage();

    expect(
      await screen.findByText("documents.noDocuments")
    ).toBeInTheDocument();
  });

  it("renders the inline error banner when the documents load rejects", async () => {
    docsReject = true;

    renderPage();

    expect(await screen.findByText("documents.loadError")).toBeInTheDocument();
  });

  // ---- Pagination (page.tsx:405-429) ----

  it("does not render the pagination block when totalPages === 1", async () => {
    renderPage();
    await screen.findByText("Annual Report.pdf");

    expect(
      screen.queryByRole("button", { name: "common.previous" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "common.next" })
    ).not.toBeInTheDocument();
  });

  it("disables Prev at page 1 and enables Next when totalPages > 1", async () => {
    docsPayload.totalPages = 3;
    docsPayload.totalCount = 50;

    renderPage();
    await screen.findByText("Annual Report.pdf");

    expect(
      screen.getByRole("button", { name: "common.previous" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "common.next" })).toBeEnabled();
  });

  it("clicking Next refetches with page=2", async () => {
    docsPayload.totalPages = 3;
    docsPayload.totalCount = 50;

    renderPage();
    await screen.findByText("Annual Report.pdf");
    const before = docCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "common.next" }));

    await waitFor(() => expect(docCalls().length).toBeGreaterThan(before));
    expect(docCalls().at(-1)).toMatchObject({ page: 2 });
  });

  // ---- Download (page.tsx:112-132) ----

  it("downloads via getDownloadUrl + dynamic getSession token + fetch blob anchor", async () => {
    const blob = new Blob(["pdf-bytes"]);
    const fetchMock = vi.fn(() =>
      Promise.resolve({ blob: () => Promise.resolve(blob) } as Response)
    );
    vi.stubGlobal("fetch", fetchMock);
    // the page dynamic-imports next-auth/react getSession()
    vi.doMock("next-auth/react", () => ({
      getSession: vi.fn(() => Promise.resolve({ accessToken: "tok-123" })),
    }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    renderPage();
    await screen.findByText("Annual Report.pdf");

    fireEvent.click(screen.getByRole("button", { name: "documents.download" }));

    await waitFor(() => expect(getDownloadUrl).toHaveBeenCalledWith("doc-1"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:5000/api/v1/documents/doc-1/download",
        expect.objectContaining({
          headers: { Authorization: "Bearer tok-123" },
        })
      )
    );
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);

    clickSpy.mockRestore();
    vi.doUnmock("next-auth/react");
  });

  it("A76: a failed download surfaces the error banner (download-error branch)", async () => {
    // Mock getSession so the ONLY failure point is the blob fetch (otherwise
    // next-auth's real getSession hits the rejecting fetch on /api/auth/session
    // and the rejection escapes as an unhandled error).
    vi.doMock("next-auth/react", () => ({
      getSession: vi.fn(() => Promise.resolve({ accessToken: "tok-123" })),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down")))
    );

    renderPage();
    await screen.findByText("Annual Report.pdf");

    fireEvent.click(screen.getByRole("button", { name: "documents.download" }));

    expect(
      await screen.findByText("documents.downloadError")
    ).toBeInTheDocument();

    vi.doUnmock("next-auth/react");
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// E29-S3 mechanism re-point: the route entry migrated from `useParams()` to the
// `params: Promise<{id}>` contract + `use(params)`. React 19's `use(promise)`
// Suspends on first render, so we drive `use` synchronously (the events
// fees/check-in S1 pattern) + pass a sync-thenable as the `params` prop. Every
// behavioural assertion below is unchanged.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react");
  return {
    ...actual,
    use: (input: unknown) => {
      const maybeThenable = input as {
        then?: (cb: (v: unknown) => void) => void;
      };
      if (maybeThenable && typeof maybeThenable.then === "function") {
        let resolved: unknown;
        let didResolve = false;
        maybeThenable.then((v) => {
          resolved = v;
          didResolve = true;
        });
        if (didResolve) return resolved;
        throw input;
      }
      return (actual.use as unknown as (x: unknown) => unknown)(input);
    },
  };
});

function syncThenable<T>(value: T): Promise<T> {
  return { then: (cb: (v: T) => void) => cb(value) } as unknown as Promise<T>;
}

/**
 * E29-S1: Characterization tests for the Board Document DETAIL page
 * (REQ-034/035/036). Pins the CURRENT observable behaviour of
 * `frontend/src/app/board/documents/[id]/page.tsx` BEFORE the E29-S3
 * feature-slice refactor.
 *
 * The god-page uses `@/lib/services/documents` (ApiResult {success,data,error})
 * for getDocumentById + review/publish/archive/restoreVersion/updateDocumentTags,
 * raw `fetch` + dynamic `next-auth/react getSession()` for the version-upload
 * FormData and the blob download, and an in-component restore-confirm modal
 * (no window.confirm). Success/error toasts auto-dismiss after 3000 ms.
 *
 * DEC-1 layer-matched hybrid mocks (the surface S3 will re-point):
 *   - vi.mock("@/lib/services/documents") for the data + action fns.
 *   - vi.mock("@/lib/auth") for a STABLE useAuth (A64/A78).
 *   - vi.mock("next-auth/react") for getSession (token for fetch).
 *   - vi.stubGlobal("fetch", …) for the version-upload FormData + the blob
 *     download; vi.unstubAllGlobals() in afterEach.
 *
 * HEAD quirk pinned (NOT i18n-fixed): on a NON-404 service error the page sets
 * `result.error || "Document not found"` (page.tsx:65) — a hardcoded English
 * fallback string. We characterize it; the visible not-found view itself
 * renders the i18n key `documents.notFound` (page.tsx:188).
 *
 * Assert via i18n KEYS / ARIA roles / service-fn args / fetch URLs / navigation
 * (AC-11), at the OUTCOME level for mutations.
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// next-auth/react: stable getSession returning a token (used by fetch paths).
const getSession = vi.fn(() => Promise.resolve({ accessToken: "tok-123" }));
vi.mock("next-auth/react", () => ({
  getSession: () => getSession(),
}));

const getDocumentById = vi.fn();
const reviewDocument = vi.fn();
const publishDocument = vi.fn();
const archiveDocument = vi.fn();
const restoreVersion = vi.fn();
const updateDocumentTags = vi.fn();
vi.mock("@/lib/services/documents", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/documents")
  >("@/lib/services/documents");
  return {
    ...actual,
    getDocumentById: (...args: unknown[]) => getDocumentById(...args),
    reviewDocument: (...args: unknown[]) => reviewDocument(...args),
    publishDocument: (...args: unknown[]) => publishDocument(...args),
    archiveDocument: (...args: unknown[]) => archiveDocument(...args),
    restoreVersion: (...args: unknown[]) => restoreVersion(...args),
    updateDocumentTags: (...args: unknown[]) => updateDocumentTags(...args),
  };
});

const authState = {
  isAuthenticated: true,
  isLoading: false,
  isVorstand: true,
  isAdmin: false,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

import DocumentDetailPage from "./page";

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "v2",
    versionNumber: 2,
    fileSize: 2048,
    contentType: "application/pdf",
    comment: "Second cut",
    uploadedAt: "2026-02-01T00:00:00Z",
    ...overrides,
  };
}

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    name: "Statutes",
    description: "Club statutes",
    category: "General",
    status: "Draft",
    folderId: "folder-1",
    contentType: "application/pdf",
    fileSize: 1024,
    tags: ["legal", "board"],
    createdAt: "2026-01-15T00:00:00Z",
    versions: [
      makeVersion({ id: "v2", versionNumber: 2 }),
      makeVersion({
        id: "v1",
        versionNumber: 1,
        comment: "First cut",
        uploadedAt: "2026-01-01T00:00:00Z",
      }),
    ],
    ...overrides,
  };
}

let detailOk: boolean;
let detailError: string | undefined;
let detailStatus: number | undefined;
let detailPayload: ReturnType<typeof makeDetail>;

function getDocumentByIdCalls() {
  return getDocumentById.mock.calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = true;
  authState.isAdmin = false;

  detailOk = true;
  detailError = undefined;
  detailStatus = undefined;
  detailPayload = makeDetail();

  getDocumentById.mockImplementation(() =>
    detailOk
      ? Promise.resolve({ success: true, data: detailPayload })
      : Promise.resolve({
          success: false,
          data: null,
          error: detailError,
          status: detailStatus,
        })
  );
  reviewDocument.mockResolvedValue({ success: true, data: null });
  publishDocument.mockResolvedValue({ success: true, data: null });
  archiveDocument.mockResolvedValue({ success: true, data: null });
  restoreVersion.mockResolvedValue({ success: true, data: makeVersion() });
  updateDocumentTags.mockResolvedValue({ success: true, data: null });

  // Raw-fetch upload + blob download. Default OK with a blob().
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(["x"])),
        json: () => Promise.resolve({}),
      })
    )
  );
  // jsdom lacks object-URL helpers; the blob-download anchor path touches them.
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
  vi.useRealTimers();
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // `retryDelay: 0`: the E29 review (P4) gives `useBoardDocument` a per-query
      // `retry` PREDICATE (404 → no retry; other errors → the provider's
      // `retry: 1`). A function `retry` overrides this client's `retry: false`,
      // so a non-404 service error now retries once — `retryDelay: 0` lets that
      // single retry settle instantly so the not-found VIEW assertion stays fast.
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentDetailPage params={syncThenable({ id: "doc-1" })} />
    </QueryClientProvider>
  );
}

describe("DocumentDetailPage — characterization (current behaviour)", () => {
  // --- AC-2/AC-3: auth guard (Vorstand OR Admin only) ---

  it("redirects an unauthenticated user to / and fires no detail fetch", async () => {
    authState.isAuthenticated = false;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getDocumentById).not.toHaveBeenCalled();
  });

  it("redirects an authenticated Member-only user to / and fires no detail fetch", async () => {
    authState.isAuthenticated = true;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getDocumentById).not.toHaveBeenCalled();
  });

  it("loads the document for an Admin-only user", async () => {
    authState.isVorstand = false;
    authState.isAdmin = true;

    renderPage();

    await waitFor(() => expect(getDocumentById).toHaveBeenCalledWith("doc-1"));
    expect(await screen.findByText("Statutes")).toBeInTheDocument();
  });

  // --- AC-6: load + metadata grid ---

  it("loads the document by id and renders header + description + status", async () => {
    renderPage();

    await waitFor(() => expect(getDocumentById).toHaveBeenCalledWith("doc-1"));
    expect(await screen.findByText("Statutes")).toBeInTheDocument();
    expect(screen.getByText("Club statutes")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders the metadata grid with the de-CH formatted created date", async () => {
    renderPage();
    await screen.findByText("Statutes");

    // 2026-01-15 → de-CH dd.mm.yyyy
    expect(screen.getByText("15.01.2026")).toBeInTheDocument();
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
  });

  // --- AC-6: 404 / not-found view + HEAD fallback-string quirk ---

  it("renders the not-found view (documents.notFound) when the GET returns 404", async () => {
    detailOk = false;
    detailStatus = 404;
    detailError = undefined;

    renderPage();

    expect(await screen.findByText("documents.notFound")).toBeInTheDocument();
  });

  it("HEAD quirk: a non-404 service error sets the hardcoded 'Document not found' fallback (document still null → notFound view)", async () => {
    // result.error is undefined on this error → page does
    // setError(result.error || "Document not found") at page.tsx:65.
    detailOk = false;
    detailStatus = 500;
    detailError = undefined;

    renderPage();

    // document is null so the not-found VIEW renders (documents.notFound);
    // the hardcoded English fallback is written into the `error` banner state.
    expect(await screen.findByText("documents.notFound")).toBeInTheDocument();
  });

  // --- AC-6: download current + per-version (blob anchor) + downloadError ---

  it("downloads the current document via fetch to the download URL with a Bearer token", async () => {
    renderPage();
    await screen.findByText("Statutes");

    // the header download button is the first "documents.download" (version
    // rows add one each).
    fireEvent.click(
      screen.getAllByRole("button", { name: "documents.download" })[0]
    );

    await waitFor(() => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      expect(fetchMock).toHaveBeenCalled();
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/documents/doc-1/download");
    expect(
      (init as { headers: Record<string, string> }).headers.Authorization
    ).toBe("Bearer tok-123");
  });

  it("downloads a specific version via the version download URL", async () => {
    renderPage();
    await screen.findByText("Statutes");

    // version-history download buttons (one per version) + the header one
    const downloadButtons = screen.getAllByRole("button", {
      name: "documents.download",
    });
    // the last version row is v1 (non-latest)
    fireEvent.click(downloadButtons[downloadButtons.length - 1]);

    await waitFor(() => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      const urls = fetchMock.mock.calls.map((c) => c[0] as string);
      expect(
        urls.some((u) =>
          u.includes("/api/v1/documents/doc-1/versions/1/download")
        )
      ).toBe(true);
    });
  });

  it("surfaces documents.downloadError when the download fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network")))
    );

    renderPage();
    await screen.findByText("Statutes");

    fireEvent.click(
      screen.getAllByRole("button", { name: "documents.download" })[0]
    );

    expect(
      await screen.findByText("documents.downloadError")
    ).toBeInTheDocument();
  });

  // --- AC-6: tag edit toggle + save → refetch ---

  it("toggles tag editing and saves via updateDocumentTags then refetches", async () => {
    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentByIdCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    const input = screen.getByPlaceholderText("documents.tagsPlaceholder");
    fireEvent.change(input, { target: { value: "alpha, beta" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(updateDocumentTags).toHaveBeenCalledWith("doc-1", [
        "alpha",
        "beta",
      ])
    );
    await waitFor(() =>
      expect(getDocumentByIdCalls().length).toBeGreaterThan(before)
    );
    expect(await screen.findByText("documents.tagsSaved")).toBeInTheDocument();
  });

  // --- AC-6: version-upload modal (FormData) → refetch / uploadError ---

  it("uploads a new version via FormData to the upload-version URL then refetches", async () => {
    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentByIdCalls().length;

    fireEvent.click(
      screen.getByRole("button", { name: "documents.uploadNewVersion" })
    );
    // the modal heading reuses the same key; just drop a file in
    const file = new File(["x"], "v3.pdf", { type: "application/pdf" });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    const uploadButtons = screen.getAllByRole("button", {
      name: "documents.upload",
    });
    fireEvent.click(uploadButtons[uploadButtons.length - 1]);

    await waitFor(() => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      const urls = fetchMock.mock.calls.map((c) => c[0] as string);
      expect(
        urls.some((u) => u.includes("/api/v1/documents/doc-1/upload-version"))
      ).toBe(true);
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls.find((c) =>
      (c[0] as string).includes("/upload-version")
    )!;
    expect(call[1].method).toBe("POST");
    expect(call[1].body).toBeInstanceOf(FormData);
    expect((call[1].body as FormData).get("file")).toBe(file);

    await waitFor(() =>
      expect(getDocumentByIdCalls().length).toBeGreaterThan(before)
    );
    expect(
      await screen.findByText("documents.versionUploaded")
    ).toBeInTheDocument();
  });

  it("surfaces documents.uploadError when the version-upload fetch is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      )
    );

    renderPage();
    await screen.findByText("Statutes");

    fireEvent.click(
      screen.getByRole("button", { name: "documents.uploadNewVersion" })
    );
    const file = new File(["x"], "v3.pdf", { type: "application/pdf" });
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

  // --- AC-6: status transitions conditional on document.status ---

  it("shows Mark-Reviewed + Publish for a Draft document and calls reviewDocument", async () => {
    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentByIdCalls().length;

    expect(
      screen.getByRole("button", { name: "documents.markReviewed" })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "documents.markReviewed" })
    );

    await waitFor(() => expect(reviewDocument).toHaveBeenCalledWith("doc-1"));
    await waitFor(() =>
      expect(getDocumentByIdCalls().length).toBeGreaterThan(before)
    );
  });

  it("shows Publish + Archive (no Mark-Reviewed) for a Reviewed document", async () => {
    detailPayload = makeDetail({ status: "Reviewed" });

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

  it("surfaces documents.statusChangeError when a status action fails", async () => {
    publishDocument.mockResolvedValue({
      success: false,
      data: null,
      error: undefined,
    });

    renderPage();
    await screen.findByText("Statutes");

    fireEvent.click(screen.getByRole("button", { name: "documents.publish" }));

    expect(
      await screen.findByText("documents.statusChangeError")
    ).toBeInTheDocument();
  });

  // --- AC-6: version history (latest highlighted; Restore on non-latest) ---

  it("renders a Restore button only on the non-latest version", async () => {
    renderPage();
    await screen.findByText("Statutes");

    // two versions; only v1 (index !== 0) gets a Restore button
    const restoreButtons = screen.getAllByRole("button", {
      name: "documents.restore",
    });
    expect(restoreButtons).toHaveLength(1);
  });

  it("Restore opens a confirm modal, then calls restoreVersion and refetches", async () => {
    renderPage();
    await screen.findByText("Statutes");
    const before = getDocumentByIdCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "documents.restore" }));
    expect(
      await screen.findByText("documents.confirmRestore")
    ).toBeInTheDocument();

    // confirm: the modal's restore button is the last "documents.restore"
    const restoreButtons = screen.getAllByRole("button", {
      name: "documents.restore",
    });
    fireEvent.click(restoreButtons[restoreButtons.length - 1]);

    await waitFor(() =>
      expect(restoreVersion).toHaveBeenCalledWith("doc-1", 1)
    );
    await waitFor(() =>
      expect(getDocumentByIdCalls().length).toBeGreaterThan(before)
    );
    expect(
      await screen.findByText("documents.versionRestored")
    ).toBeInTheDocument();
  });

  it("does not call restoreVersion when the restore modal is cancelled", async () => {
    renderPage();
    await screen.findByText("Statutes");

    fireEvent.click(screen.getByRole("button", { name: "documents.restore" }));
    await screen.findByText("documents.confirmRestore");
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    await waitFor(() =>
      expect(
        screen.queryByText("documents.confirmRestore")
      ).not.toBeInTheDocument()
    );
    expect(restoreVersion).not.toHaveBeenCalled();
  });

  it("shows the no-versions empty state when there are no versions", async () => {
    detailPayload = makeDetail({ versions: [] });

    renderPage();
    await screen.findByText("Statutes");

    expect(screen.getByText("documents.noVersions")).toBeInTheDocument();
  });

  // --- AC-6: toast auto-dismiss after 3000 ms ---

  it("auto-dismisses the success toast after 3000 ms", async () => {
    // Fake timers from the start so the setTimeout(…, 3000) auto-dismiss is
    // registered on the fake clock. runAllTimersAsync flushes both pending
    // promises (the load/mutation) and timers under one act().
    vi.useFakeTimers();

    renderPage();
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(screen.getByText("Statutes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "documents.publish" }));
    // Flush the publish mutation + refetch microtasks (the toast is now set,
    // and its 3000 ms dismiss timer is pending on the fake clock).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("documents.statusChanged")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(
      screen.queryByText("documents.statusChanged")
    ).not.toBeInTheDocument();
  });

  // --- AC-9: loading lifecycle ---

  it("renders the loading spinner while the detail load is pending", async () => {
    getDocumentById.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() => expect(getDocumentById).toHaveBeenCalled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

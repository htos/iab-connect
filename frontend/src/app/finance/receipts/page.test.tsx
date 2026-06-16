// @vitest-environment jsdom
//
// E26-S1 (S3) characterization net — receipts page.
//
// A56 note: GUARD = lean canReadFinance ONLY (no isAuthenticated / authLoading).
//   useEffect -> router.replace("/"); render-time `if (!canReadFinance) return null`. CONFIRMED.
// A79 deltas:
//   - Upload = api.upload("/api/v1/finance/receipts", FormData) with fields "file" + "notes",
//     Content-Type omitted. The save handler does NOT inspect res.error (silent on upload
//     failure — only the try/catch surfaces an exception). Pinned.
//   - Download = api.get("/receipts/{id}/download") -> Blob -> object URL -> anchor
//     download=receipt.fileName (the server fileName, NOT a hardcoded client name) -> click.
//     Anchor is NOT DOM-appended (a.click() directly).
//   - Delete = modal confirm -> DELETE /receipts/{id}; modal (two-step) confirm. red button.
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
  usePathname: () => "/finance/receipts",
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

const receipts = [
  {
    id: "rec-1",
    fileName: "invoice-scan.pdf",
    contentType: "application/pdf",
    fileSize: 2048,
    notes: "Hotel bill",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "rec-2",
    fileName: "photo.png",
    contentType: "image/png",
    fileSize: 4096,
    notes: "",
    createdAt: "2026-01-02T00:00:00Z",
  },
];

function routeGet(url: string) {
  if (url === "/api/v1/finance/receipts") {
    return Promise.resolve({
      data: { items: receipts },
      error: null,
      status: 200,
    });
  }
  return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
}

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();
  // The page calls window.URL.* — make those resolve too.
  window.URL.createObjectURL = global.URL.createObjectURL;
  window.URL.revokeObjectURL = global.URL.revokeObjectURL;
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

describe("receipts — read guard (lean)", () => {
  it("replaces to / and fires no GET when !canReadFinance", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe("receipts — happy path + endpoint", () => {
  it("GETs /api/v1/finance/receipts and renders the cards", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("invoice-scan.pdf")).toBeInTheDocument()
    );
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/receipts");
    expect(screen.getByText("photo.png")).toBeInTheDocument();
  });

  it("renders the empty state when there are no receipts", async () => {
    apiGet.mockResolvedValue({ data: { items: [] }, error: null, status: 200 });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("noReceipts")).toBeInTheDocument()
    );
  });
});

describe("receipts — write-gating", () => {
  it("shows Upload + per-card Delete when canWriteFinance", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("invoice-scan.pdf")).toBeInTheDocument()
    );
    expect(screen.getByText("uploadReceipt")).toBeInTheDocument();
    expect(screen.getAllByText("delete")).toHaveLength(2);
  });

  it("hides Upload + Delete for a read-only user", async () => {
    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("invoice-scan.pdf")).toBeInTheDocument()
    );
    expect(screen.queryByText("uploadReceipt")).not.toBeInTheDocument();
    expect(screen.queryByText("delete")).not.toBeInTheDocument();
  });
});

describe("receipts — upload (FormData file + notes)", () => {
  it("uploads via api.upload with FormData fields 'file' and 'notes' to /receipts", async () => {
    const { container } = render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("invoice-scan.pdf")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("uploadReceipt"));

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["x"], "new-receipt.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });
    // The notes <textarea> has no associated label (no htmlFor) — select it directly.
    const notesArea = container.querySelector(
      "textarea"
    ) as HTMLTextAreaElement;
    fireEvent.change(notesArea, { target: { value: "my notes" } });

    fireEvent.click(screen.getByText("save"));
    await waitFor(() =>
      expect(apiUpload).toHaveBeenCalledWith(
        "/api/v1/finance/receipts",
        expect.any(FormData)
      )
    );
    const fd = apiUpload.mock.calls[0][1] as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
    expect(fd.get("notes")).toBe("my notes");
  });
});

describe("receipts — download (blob -> server fileName)", () => {
  it("GETs /receipts/{id}/download, creates an object URL and uses the server fileName", async () => {
    const blob = new Blob(["x"], { type: "application/pdf" });
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/receipts/rec-1/download") {
        return Promise.resolve({ data: blob, error: null, status: 200 });
      }
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("invoice-scan.pdf")).toBeInTheDocument()
    );
    fireEvent.click(screen.getAllByText("download")[0]);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        "/api/v1/finance/receipts/rec-1/download"
      )
    );
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(blob);
  });
});

describe("receipts — delete (modal confirm -> DELETE)", () => {
  it("first click arms the confirm modal; confirm DELETEs /receipts/{id}", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("invoice-scan.pdf")).toBeInTheDocument()
    );
    fireEvent.click(screen.getAllByText("delete")[0]);
    expect(apiDelete).not.toHaveBeenCalled();
    // Modal confirm copy + red confirm button.
    expect(screen.getByText("confirmDelete")).toBeInTheDocument();
    const confirmBtn = screen
      .getAllByText("delete")
      .find((el) => el.className.includes("bg-red-600"))!;
    fireEvent.click(confirmBtn);
    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith("/api/v1/finance/receipts/rec-1")
    );
  });
});

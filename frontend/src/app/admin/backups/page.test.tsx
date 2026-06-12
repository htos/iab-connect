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

// E27-S1 characterization tests (regression net) for the Backup Management admin page.
// Pins CURRENT observable behaviour at HEAD. No production code changed.
// The page consumes the @/lib/api/backup transport functions directly with the
// access token (NOT useApiClient), so we mock that module at the boundary while
// keeping the real colour/format helpers (getStatusColor/getTypeColor/formatFileSize).
//
// A79 deltas: this page does NOT use TanStack Query; data is loaded via
// useState/useEffect, so `retry:false` masks nothing. The success message uses a
// 5s auto-dismiss setTimeout; we do NOT assert the dismissal (covered conceptually
// in retention). The QueryClientProvider wrapper is inert.

// A64: STABLE identity translation function. fetchBackups depends on `t` and feeds
// an effect dependency array; an unstable `t` (new arrow each render) causes spurious
// refetch loops. A hoisted stable identity fn mirrors production (next-intl memoizes).
const tFn = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => tFn }));
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
  accessToken: "test-token",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  }),
}));

const getBackups = vi.fn();
const createBackup = vi.fn();
const deleteBackup = vi.fn();
const downloadBackup = vi.fn();
const restoreBackup = vi.fn();
const uploadBackup = vi.fn();
const getBackupSchedule = vi.fn();
const setBackupSchedule = vi.fn();
const disableBackupSchedule = vi.fn();
vi.mock("@/lib/api/backup", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/backup")>(
      "@/lib/api/backup"
    );
  return {
    ...actual,
    getBackups: (...a: unknown[]) => getBackups(...a),
    createBackup: (...a: unknown[]) => createBackup(...a),
    deleteBackup: (...a: unknown[]) => deleteBackup(...a),
    downloadBackup: (...a: unknown[]) => downloadBackup(...a),
    restoreBackup: (...a: unknown[]) => restoreBackup(...a),
    uploadBackup: (...a: unknown[]) => uploadBackup(...a),
    getBackupSchedule: (...a: unknown[]) => getBackupSchedule(...a),
    setBackupSchedule: (...a: unknown[]) => setBackupSchedule(...a),
    disableBackupSchedule: (...a: unknown[]) => disableBackupSchedule(...a),
  };
});

import BackupsPage from "./page";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function makeBackup(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    fileName: "backup_2026.sql",
    fileSizeBytes: 2048,
    type: "Manual",
    status: "Completed",
    notes: null,
    createdBy: "admin",
    createdAt: "2026-06-01T10:00:00Z",
    completedAt: "2026-06-01T10:05:00Z",
    errorMessage: null,
    restoredAt: null,
    restoredBy: null,
    ...overrides,
  };
}

beforeEach(() => {
  getBackups.mockResolvedValue([makeBackup()]);
  getBackupSchedule.mockResolvedValue({ enabled: false, cronExpression: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
});

describe("BackupsPage — AC-1 guard", () => {
  it("redirects non-admin users to '/'", async () => {
    authState.isAdmin = false;
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("redirects unauthenticated users to '/'", async () => {
    authState.isAuthenticated = false;
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("does not fetch backups when not admin", async () => {
    authState.isAdmin = false;
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getBackups).not.toHaveBeenCalled();
  });

  it("fetches backups and schedule when admin", async () => {
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(getBackups).toHaveBeenCalledWith("test-token"));
    expect(getBackupSchedule).toHaveBeenCalledWith("test-token");
  });
});

describe("BackupsPage — list / stats / empty / error", () => {
  it("renders backups list with file name", async () => {
    renderWithClient(<BackupsPage />);
    expect(await screen.findByText("backup_2026.sql")).toBeInTheDocument();
  });

  it("renders the empty state when there are no backups", async () => {
    getBackups.mockResolvedValue([]);
    renderWithClient(<BackupsPage />);
    expect(await screen.findByText("noBackups")).toBeInTheDocument();
    expect(screen.getByText("noBackupsDescription")).toBeInTheDocument();
  });

  it("surfaces a load error", async () => {
    getBackups.mockRejectedValue(new Error("load-fail"));
    renderWithClient(<BackupsPage />);
    expect(await screen.findByText("load-fail")).toBeInTheDocument();
  });

  it("renders the stats summary labels", async () => {
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(getBackups).toHaveBeenCalled());
    expect(screen.getByText("stats.total")).toBeInTheDocument();
    expect(screen.getByText("stats.completed")).toBeInTheDocument();
    expect(screen.getByText("stats.totalSize")).toBeInTheDocument();
  });
});

describe("BackupsPage — status + type badges (real helpers)", () => {
  it("renders a Completed status badge in green", async () => {
    getBackups.mockResolvedValue([makeBackup({ status: "Completed" })]);
    renderWithClient(<BackupsPage />);
    const badge = await screen.findByText("statuses.completed");
    expect(badge.className).toContain("bg-green-100");
  });

  it("renders an InProgress status badge in yellow", async () => {
    getBackups.mockResolvedValue([makeBackup({ status: "InProgress" })]);
    renderWithClient(<BackupsPage />);
    const badge = await screen.findByText("statuses.inprogress");
    expect(badge.className).toContain("bg-yellow-100");
  });

  it("renders a Failed status badge in red", async () => {
    getBackups.mockResolvedValue([
      makeBackup({ status: "Failed", errorMessage: "disk full" }),
    ]);
    renderWithClient(<BackupsPage />);
    const badge = await screen.findByText("statuses.failed");
    expect(badge.className).toContain("bg-red-100");
  });

  it("renders the Manual type badge in blue", async () => {
    getBackups.mockResolvedValue([makeBackup({ type: "Manual" })]);
    renderWithClient(<BackupsPage />);
    const badge = await screen.findByText("types.manual");
    expect(badge.className).toContain("bg-blue-100");
  });
});

describe("BackupsPage — create (modal + notes)", () => {
  it("opens the create modal and submits with notes, then shows success", async () => {
    createBackup.mockResolvedValue(makeBackup());
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(getBackups).toHaveBeenCalled());

    fireEvent.click(screen.getByText("createBackup"));
    expect(screen.getByText("createModal.title")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("createModal.notes"), {
      target: { value: "nightly" },
    });
    fireEvent.click(screen.getByText("createModal.confirm"));

    await waitFor(() =>
      expect(createBackup).toHaveBeenCalledWith("test-token", "nightly")
    );
    expect(await screen.findByText("createSuccess")).toBeInTheDocument();
  });

  it("surfaces a create error", async () => {
    createBackup.mockRejectedValue(new Error("create-fail"));
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(getBackups).toHaveBeenCalled());
    fireEvent.click(screen.getByText("createBackup"));
    fireEvent.click(screen.getByText("createModal.confirm"));
    expect(await screen.findByText("create-fail")).toBeInTheDocument();
  });
});

describe("BackupsPage — restore (inline 2-button confirm, RED confirm)", () => {
  it("only offers restore on Completed rows and trigger is RED", async () => {
    getBackups.mockResolvedValue([makeBackup({ status: "Completed" })]);
    renderWithClient(<BackupsPage />);
    const trigger = await screen.findByTitle("actions.restore");
    // E27-S4 DEC-4 = A (A86): restore is the highest-risk action and shipped only
    // orange/blue (no destructive affordance) at HEAD; the slice promotes it to RED
    // (the one place A86 sanctions ADDING red). Trigger button is now red.
    expect(trigger.className).toContain("text-red-600");
  });

  it("clicking restore reveals confirm/cancel; confirm is RED", async () => {
    getBackups.mockResolvedValue([makeBackup({ status: "Completed" })]);
    renderWithClient(<BackupsPage />);
    const trigger = await screen.findByTitle("actions.restore");
    fireEvent.click(trigger);
    const confirm = screen.getByText("confirm");
    // E27-S4 DEC-4 = A (A86): confirm is now red (text-red-600 + bg-red-50).
    expect(confirm.className).toContain("text-red-600");
    expect(confirm.className).toContain("bg-red-50");
    expect(screen.getByText("cancel")).toBeInTheDocument();
  });

  it("confirming restore calls restoreBackup and shows success", async () => {
    getBackups.mockResolvedValue([makeBackup({ status: "Completed" })]);
    restoreBackup.mockResolvedValue(makeBackup());
    renderWithClient(<BackupsPage />);
    fireEvent.click(await screen.findByTitle("actions.restore"));
    fireEvent.click(screen.getByText("confirm"));
    await waitFor(() =>
      expect(restoreBackup).toHaveBeenCalledWith("test-token", "b1")
    );
    expect(await screen.findByText("restoreSuccess")).toBeInTheDocument();
  });

  it("restore failure keeps the confirm state (confirm button still present) and shows error", async () => {
    getBackups.mockResolvedValue([makeBackup({ status: "Completed" })]);
    restoreBackup.mockRejectedValue(new Error("restore-fail"));
    renderWithClient(<BackupsPage />);
    fireEvent.click(await screen.findByTitle("actions.restore"));
    fireEvent.click(screen.getByText("confirm"));
    expect(await screen.findByText("restore-fail")).toBeInTheDocument();
    // confirm state retained on failure (setRestoreConfirmId(null) only runs on success)
    expect(screen.getByText("confirm")).toBeInTheDocument();
  });
});

describe("BackupsPage — delete (inline 2-button confirm, RED)", () => {
  it("delete trigger is RED", async () => {
    renderWithClient(<BackupsPage />);
    const trigger = await screen.findByTitle("actions.delete");
    expect(trigger.className).toContain("text-red-600");
  });

  it("clicking delete reveals a RED confirm button", async () => {
    renderWithClient(<BackupsPage />);
    fireEvent.click(await screen.findByTitle("actions.delete"));
    const confirm = screen.getByText("confirm");
    expect(confirm.className).toContain("text-red-600");
    expect(confirm.className).toContain("bg-red-50");
  });

  it("confirming delete calls deleteBackup and shows success", async () => {
    deleteBackup.mockResolvedValue(undefined);
    renderWithClient(<BackupsPage />);
    fireEvent.click(await screen.findByTitle("actions.delete"));
    fireEvent.click(screen.getByText("confirm"));
    await waitFor(() =>
      expect(deleteBackup).toHaveBeenCalledWith("test-token", "b1")
    );
    expect(await screen.findByText("deleteSuccess")).toBeInTheDocument();
  });

  it("delete failure keeps confirm state and surfaces error", async () => {
    deleteBackup.mockRejectedValue(new Error("delete-fail"));
    renderWithClient(<BackupsPage />);
    fireEvent.click(await screen.findByTitle("actions.delete"));
    fireEvent.click(screen.getByText("confirm"));
    expect(await screen.findByText("delete-fail")).toBeInTheDocument();
    // setDeleteConfirmId(null) only runs on success — confirm stays visible.
    expect(screen.getByText("confirm")).toBeInTheDocument();
  });
});

describe("BackupsPage — download (Completed only)", () => {
  it("shows a download button on Completed rows and calls downloadBackup", async () => {
    getBackups.mockResolvedValue([makeBackup({ status: "Completed" })]);
    downloadBackup.mockResolvedValue(undefined);
    renderWithClient(<BackupsPage />);
    const dl = await screen.findByTitle("actions.download");
    fireEvent.click(dl);
    await waitFor(() =>
      expect(downloadBackup).toHaveBeenCalledWith(
        "test-token",
        "b1",
        "backup_2026.sql"
      )
    );
  });

  it("does NOT show a download button on Failed rows", async () => {
    getBackups.mockResolvedValue([
      makeBackup({ status: "Failed", errorMessage: "x" }),
    ]);
    renderWithClient(<BackupsPage />);
    await screen.findByText("statuses.failed");
    expect(screen.queryByTitle("actions.download")).not.toBeInTheDocument();
  });
});

describe("BackupsPage — retry (Failed rows)", () => {
  it("shows a retry button on Failed rows and re-creates the backup", async () => {
    getBackups.mockResolvedValue([
      makeBackup({ status: "Failed", notes: "orig", errorMessage: "x" }),
    ]);
    createBackup.mockResolvedValue(makeBackup());
    renderWithClient(<BackupsPage />);
    const retry = await screen.findByTitle("actions.retry");
    // CURRENT affordance: retry is orange.
    expect(retry.className).toContain("text-orange-600");
    fireEvent.click(retry);
    await waitFor(() =>
      expect(createBackup).toHaveBeenCalledWith("test-token", "orig")
    );
    expect(await screen.findByText("retrySuccess")).toBeInTheDocument();
  });

  it("retry failure surfaces the create error", async () => {
    getBackups.mockResolvedValue([
      makeBackup({ status: "Failed", errorMessage: "x" }),
    ]);
    createBackup.mockRejectedValue(new Error("retry-fail"));
    renderWithClient(<BackupsPage />);
    fireEvent.click(await screen.findByTitle("actions.retry"));
    expect(await screen.findByText("retry-fail")).toBeInTheDocument();
  });
});

describe("BackupsPage — upload (modal, FormData)", () => {
  it("uploads the selected file via uploadBackup and shows success", async () => {
    uploadBackup.mockResolvedValue(makeBackup());
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(getBackups).toHaveBeenCalled());

    fireEvent.click(screen.getByText("uploadBackup"));
    expect(screen.getByText("uploadModal.title")).toBeInTheDocument();

    const file = new File(["data"], "restore.sql", { type: "application/sql" });
    const input = screen.getByLabelText("uploadModal.file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("uploadModal.notes"), {
      target: { value: "from disk" },
    });

    fireEvent.click(screen.getByText("uploadModal.confirm"));
    await waitFor(() =>
      expect(uploadBackup).toHaveBeenCalledWith("test-token", file, "from disk")
    );
    expect(await screen.findByText("uploadSuccess")).toBeInTheDocument();
  });

  it("keeps the upload confirm disabled until a file is chosen", async () => {
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(getBackups).toHaveBeenCalled());
    fireEvent.click(screen.getByText("uploadBackup"));
    const confirm = screen
      .getByText("uploadModal.confirm")
      .closest("button") as HTMLButtonElement;
    expect(confirm).toBeDisabled();
  });
});

describe("BackupsPage — schedule disable", () => {
  it("renders a disable button when the schedule is enabled and calls disableBackupSchedule", async () => {
    getBackupSchedule.mockResolvedValue({
      enabled: true,
      cronExpression: "0 2 * * *",
    });
    disableBackupSchedule.mockResolvedValue({
      enabled: false,
      cronExpression: null,
    });
    renderWithClient(<BackupsPage />);
    const disableBtn = await screen.findByText("schedule.disable");
    // CURRENT affordance: disable is a red-tinted button.
    expect(disableBtn.className).toContain("text-red-700");
    fireEvent.click(disableBtn);
    await waitFor(() =>
      expect(disableBackupSchedule).toHaveBeenCalledWith("test-token")
    );
    expect(
      await screen.findByText("schedule.disableSuccess")
    ).toBeInTheDocument();
  });

  it("does not show a disable button when the schedule is not enabled", async () => {
    getBackupSchedule.mockResolvedValue({
      enabled: false,
      cronExpression: null,
    });
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(getBackups).toHaveBeenCalled());
    expect(screen.queryByText("schedule.disable")).not.toBeInTheDocument();
  });

  it("saving the schedule calls setBackupSchedule with the daily preset cron", async () => {
    setBackupSchedule.mockResolvedValue({
      enabled: true,
      cronExpression: "0 2 * * *",
    });
    renderWithClient(<BackupsPage />);
    await waitFor(() => expect(getBackups).toHaveBeenCalled());
    fireEvent.click(screen.getByText("schedule.save"));
    await waitFor(() =>
      expect(setBackupSchedule).toHaveBeenCalledWith("test-token", "0 2 * * *")
    );
  });
});

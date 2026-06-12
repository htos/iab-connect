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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// E27-S1 characterization tests (regression net) for the Admin Documents page.
// Pins CURRENT observable behaviour at HEAD. No production code changed.
//
// REALITY CORRECTION (epic skeleton was WRONG — DEC-3=A, pin the ACTUAL surface):
// `src/app/admin/documents/page.tsx` is a FOLDER & PERMISSION manager (REQ-035),
// NOT a file/document manager. There is NO file upload, NO document list, NO
// delete-document, NO status badges. It manages document FOLDERS (hierarchical
// drill-down + per-role permission entries). All tests below pin THAT surface.
//
// The page consumes the @/lib/services/documents transport functions directly
// (getFolders/createFolder/updateFolder/deleteFolder/setFolderPermissions), each
// returning an ApiResult<T> = { success, data, error? }. We mock that module at
// the boundary. The page does NOT use useApiClient.
//
// A79 deltas: this page does NOT use TanStack Query — folder data is loaded via
// useState/useEffect + the ApiResult-returning service. `retry:false` therefore
// masks nothing here; the QueryClientProvider wrapper is inert (kept for harness
// parity per A87). The only timer-based behaviour is the 3s success-banner
// auto-dismiss (setTimeout). We do not assert the dismissal, so no fake timers
// are needed and nothing is masked.

// A64 / harness note: STABLE identity translation function (module-level), NOT a
// fresh arrow per render. `fetchFolders` is a useCallback and the page wires
// effects through it; an unstable `t` risks spurious render churn. A hoisted
// stable identity fn mirrors production (next-intl memoizes the translator).
const tFn = (key: string, vars?: Record<string, unknown>) =>
  vars && "count" in vars ? `${key}:${vars.count}` : key;
vi.mock("next-intl", () => ({ useTranslations: () => tFn }));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

// MUTABLE auth state so we can exercise the admin guard. Note: the documents
// page reads only isAuthenticated / isLoading / isAdmin from useAuth (NOT
// accessToken — the data fetch is gated on isAuthenticated && isAdmin).
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

const getFolders = vi.fn();
const createFolder = vi.fn();
const updateFolder = vi.fn();
const deleteFolder = vi.fn();
const setFolderPermissions = vi.fn();
vi.mock("@/lib/services/documents", () => ({
  getFolders: (...args: unknown[]) => getFolders(...args),
  createFolder: (...args: unknown[]) => createFolder(...args),
  updateFolder: (...args: unknown[]) => updateFolder(...args),
  deleteFolder: (...args: unknown[]) => deleteFolder(...args),
  setFolderPermissions: (...args: unknown[]) => setFolderPermissions(...args),
}));

import AdminDocumentsPage from "./page";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

interface FolderOverrides {
  id?: string;
  name?: string;
  description?: string;
  parentFolderId?: string;
  sortOrder?: number;
  permissions?: { role: string; permissionType: string }[];
  createdAt?: string;
}

function makeFolder(overrides: FolderOverrides = {}) {
  return {
    id: "f1",
    name: "Protocols",
    description: "Board protocols",
    sortOrder: 0,
    permissions: [],
    createdAt: "2026-06-01T10:00:00Z",
    ...overrides,
  };
}

// The page calls getFolders(currentParent) for the list, then getFolders(f.id)
// per folder to compute subfolder counts. This helper returns the top-level
// list for the "root" / undefined call and an empty list for any child-count
// probe, unless a child map is provided.
function mockFolderTree(
  rootFolders: ReturnType<typeof makeFolder>[],
  childMap: Record<string, ReturnType<typeof makeFolder>[]> = {}
) {
  getFolders.mockImplementation((parentId?: string) => {
    if (parentId === undefined) {
      return Promise.resolve({ success: true, data: rootFolders });
    }
    return Promise.resolve({
      success: true,
      data: childMap[parentId] ?? [],
    });
  });
}

beforeEach(() => {
  mockFolderTree([makeFolder()]);
  createFolder.mockResolvedValue({ success: true, data: makeFolder() });
  updateFolder.mockResolvedValue({ success: true, data: {} });
  deleteFolder.mockResolvedValue({ success: true, data: {} });
  setFolderPermissions.mockResolvedValue({ success: true, data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
});

describe("AdminDocumentsPage — AC-1 admin guard", () => {
  it("redirects non-admin users to '/' (not /login)", async () => {
    authState.isAdmin = false;
    renderWithClient(<AdminDocumentsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("redirects unauthenticated users to '/'", async () => {
    authState.isAuthenticated = false;
    renderWithClient(<AdminDocumentsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("does NOT fetch folders when not admin", async () => {
    authState.isAdmin = false;
    renderWithClient(<AdminDocumentsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getFolders).not.toHaveBeenCalled();
  });

  // REALITY: unlike most admin pages, this page does NOT early-return null for a
  // non-admin. authLoading is false, so it renders the full <main> (with the
  // loading spinner, since the fetch never runs) WHILE the redirect fires. We pin
  // that CURRENT behaviour: push("/") AND a rendered <main> (NOT null).
  it("renders the page shell (NOT null) for an authenticated non-admin while redirecting", async () => {
    authState.isAdmin = false;
    const { container } = renderWithClient(<AdminDocumentsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(container.querySelector("main")).not.toBeNull();
  });

  // REALITY: while authLoading is true the page early-returns the auth spinner
  // (no <main>). NOTE the fetch-gating effect keys only on isAuthenticated &&
  // isAdmin (NOT authLoading), so with both still true the fetch DOES fire even
  // during auth-loading. We pin that current quirk rather than "fixing" it.
  it("shows the auth-loading spinner (and renders no main) while authLoading is true", () => {
    authState.isLoading = true;
    const { container } = renderWithClient(<AdminDocumentsPage />);
    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(container.querySelector("main")).toBeNull();
  });

  it("fetches folders when an authenticated admin (gated on isAuthenticated && isAdmin)", async () => {
    renderWithClient(<AdminDocumentsPage />);
    await waitFor(() => expect(getFolders).toHaveBeenCalled());
    // First (list) call is for the root: parentId undefined.
    expect(getFolders).toHaveBeenCalledWith(undefined);
  });
});

describe("AdminDocumentsPage — folder list load / empty / error", () => {
  it("renders the admin title + subtitle", async () => {
    renderWithClient(<AdminDocumentsPage />);
    expect(await screen.findByText("documents.adminTitle")).toBeInTheDocument();
    expect(screen.getByText("documents.adminSubtitle")).toBeInTheDocument();
  });

  it("renders a loaded folder row", async () => {
    mockFolderTree([makeFolder({ name: "Protocols" })]);
    renderWithClient(<AdminDocumentsPage />);
    expect(await screen.findByText("Protocols")).toBeInTheDocument();
  });

  it("shows the root empty-state (noFolders) when there are no folders at root", async () => {
    mockFolderTree([]);
    renderWithClient(<AdminDocumentsPage />);
    expect(await screen.findByText("documents.noFolders")).toBeInTheDocument();
    expect(
      screen.queryByText("documents.noSubfolders")
    ).not.toBeInTheDocument();
  });

  it("surfaces an error banner when the folder load fails", async () => {
    getFolders.mockResolvedValueOnce({ success: false, error: "boom" });
    renderWithClient(<AdminDocumentsPage />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("renders the subfolder-count hint when a folder has children", async () => {
    mockFolderTree([makeFolder({ id: "f1", name: "Protocols" })], {
      f1: [makeFolder({ id: "c1", name: "2025" })],
    });
    renderWithClient(<AdminDocumentsPage />);
    // tFn formats count vars as `key:count`. One subfolder => subfolderCount:1.
    expect(
      await screen.findByText("(documents.subfolderCount:1)")
    ).toBeInTheDocument();
  });
});

describe("AdminDocumentsPage — drill-down + back navigation", () => {
  it("drills into a folder (refetches with the child parentId) and shows the back button", async () => {
    mockFolderTree([makeFolder({ id: "f1", name: "Protocols" })], {
      f1: [makeFolder({ id: "c1", name: "2025" })],
    });
    renderWithClient(<AdminDocumentsPage />);
    const row = await screen.findByText("Protocols");
    fireEvent.click(row);
    // Now inside f1: the list call uses parentId "f1".
    await waitFor(() => expect(getFolders).toHaveBeenCalledWith("f1"));
    // The subfolder "2025" is rendered, and a back-to-parent button appears.
    expect(await screen.findByText("2025")).toBeInTheDocument();
    expect(screen.getByText("documents.backToParent")).toBeInTheDocument();
  });

  it("shows the noSubfolders empty-state when a drilled-in folder has no children", async () => {
    mockFolderTree([makeFolder({ id: "f1", name: "Protocols" })], { f1: [] });
    renderWithClient(<AdminDocumentsPage />);
    fireEvent.click(await screen.findByText("Protocols"));
    expect(
      await screen.findByText("documents.noSubfolders")
    ).toBeInTheDocument();
  });

  it("the back button returns to the parent (refetches root)", async () => {
    mockFolderTree([makeFolder({ id: "f1", name: "Protocols" })], {
      f1: [makeFolder({ id: "c1", name: "2025" })],
    });
    renderWithClient(<AdminDocumentsPage />);
    fireEvent.click(await screen.findByText("Protocols"));
    await screen.findByText("documents.backToParent");
    getFolders.mockClear();
    fireEvent.click(screen.getByText("documents.backToParent"));
    // Back to root => list call with parentId undefined.
    await waitFor(() => expect(getFolders).toHaveBeenCalledWith(undefined));
    expect(
      screen.queryByText("documents.backToParent")
    ).not.toBeInTheDocument();
  });
});

describe("AdminDocumentsPage — search box (client-side filter)", () => {
  it("filters folders by name as you type", async () => {
    // Distinct descriptions: the filter matches name OR description, so a shared
    // description would keep the other row visible. Keep them disjoint.
    mockFolderTree([
      makeFolder({ id: "f1", name: "Protocols", description: "board minutes" }),
      makeFolder({ id: "f2", name: "Invoices", description: "supplier bills" }),
    ]);
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("documents.searchDocuments"), {
      target: { value: "proto" },
    });
    expect(screen.getByText("Protocols")).toBeInTheDocument();
    expect(screen.queryByText("Invoices")).not.toBeInTheDocument();
  });
});

// The modal labels are NOT wired to their controls via htmlFor/id, so
// getByLabelText does not work for them. We open the modal then read its single
// text <input> by position within the modal card. The create/edit modal cards
// are the only ones rendered at a time in these tests.
function openCreateModal() {
  // Header button label is documents.createFolder; the modal <h2> shares the key,
  // so there are two matches once open. Click the header button (first match).
  fireEvent.click(screen.getAllByText("documents.createFolder")[0]);
}

function createModalCard(): HTMLElement {
  // The modal heading <h2> is documents.createFolder; its closest card div holds
  // the inputs. There are two documents.createFolder nodes (button + h2); the h2
  // is the modal title.
  const headings = screen.getAllByText("documents.createFolder");
  const h2 = headings.find((n) => n.tagName === "H2")!;
  return h2.closest("div.bg-white") as HTMLElement;
}

describe("AdminDocumentsPage — create-folder modal", () => {
  it("opens the create modal, submits, and calls createFolder with the current parent", async () => {
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    openCreateModal();
    const card = createModalCard();
    const nameInput = card.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Folder" } });
    fireEvent.click(within(card).getByText("common.save"));
    await waitFor(() =>
      expect(createFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Folder",
          parentFolderId: undefined,
        })
      )
    );
  });

  it("shows the success banner after a successful create", async () => {
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    openCreateModal();
    const card = createModalCard();
    fireEvent.change(
      card.querySelector('input[type="text"]') as HTMLInputElement,
      {
        target: { value: "New Folder" },
      }
    );
    fireEvent.click(within(card).getByText("common.save"));
    expect(
      await screen.findByText("documents.folderCreated")
    ).toBeInTheDocument();
  });

  it("keeps the save button disabled until a name is entered", async () => {
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    openCreateModal();
    const card = createModalCard();
    const save = within(card).getByText("common.save");
    expect(save).toBeDisabled();
    fireEvent.change(
      card.querySelector('input[type="text"]') as HTMLInputElement,
      {
        target: { value: "x" },
      }
    );
    expect(save).not.toBeDisabled();
  });
});

describe("AdminDocumentsPage — edit-folder modal", () => {
  it("opens the edit modal pre-filled and calls updateFolder on save", async () => {
    mockFolderTree([
      makeFolder({ id: "f1", name: "Protocols", description: "desc" }),
    ]);
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    fireEvent.click(screen.getByText("common.edit"));
    expect(screen.getByText("documents.editFolder")).toBeInTheDocument();
    const nameInput = screen.getByDisplayValue("Protocols");
    fireEvent.change(nameInput, { target: { value: "Protocols Renamed" } });
    fireEvent.click(screen.getByText("common.save"));
    await waitFor(() =>
      expect(updateFolder).toHaveBeenCalledWith(
        "f1",
        expect.objectContaining({ name: "Protocols Renamed" })
      )
    );
    expect(
      await screen.findByText("documents.folderUpdated")
    ).toBeInTheDocument();
  });
});

// The "documents.permissions" text appears in BOTH the table <th> header and the
// per-row action button, so getByText is ambiguous. The row action button is the
// one with the orange action className; click that to open the modal. The two
// permission <select>s are not label-associated, so we read them in DOM order
// inside the modal card (Member first, Vorstand second).
function openPermissionsModal() {
  const trigger = screen
    .getAllByText("documents.permissions")
    .find(
      (n) => n.tagName === "BUTTON" && n.className.includes("text-orange-600")
    )!;
  fireEvent.click(trigger);
}

function permissionsModalCard(): HTMLElement {
  // Modal <h2> text is `documents.permissions: <name>` (single combined node via
  // the tFn identity translator + folder name). Locate the card by its two selects.
  const selects = Array.from(document.querySelectorAll("select"));
  return selects[0].closest("div.bg-white") as HTMLElement;
}

describe("AdminDocumentsPage — set-permissions modal (two selects)", () => {
  it("opens permissions with the existing role permissions pre-selected", async () => {
    mockFolderTree([
      makeFolder({
        id: "f1",
        name: "Protocols",
        permissions: [
          { role: "Member", permissionType: "Read" },
          { role: "Vorstand", permissionType: "Manage" },
        ],
      }),
    ]);
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    openPermissionsModal();
    const selects = within(permissionsModalCard()).getAllByRole(
      "combobox"
    ) as HTMLSelectElement[];
    const [memberSelect, vorstandSelect] = selects;
    expect(memberSelect.value).toBe("Read");
    expect(vorstandSelect.value).toBe("Manage");
    // Member select has no "Manage" option (only ""/Read/Write); Vorstand does.
    expect(
      within(memberSelect).queryByText("documents.manage")
    ).not.toBeInTheDocument();
    expect(
      within(vorstandSelect).getByText("documents.manage")
    ).toBeInTheDocument();
  });

  it("saves only the non-empty permission entries via setFolderPermissions", async () => {
    mockFolderTree([
      makeFolder({
        id: "f1",
        name: "Protocols",
        permissions: [{ role: "Member", permissionType: "Read" }],
      }),
    ]);
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    openPermissionsModal();
    const card = permissionsModalCard();
    const vorstandSelect = within(card).getAllByRole("combobox")[1];
    fireEvent.change(vorstandSelect, { target: { value: "Write" } });
    fireEvent.click(within(card).getByText("common.save"));
    await waitFor(() =>
      expect(setFolderPermissions).toHaveBeenCalledWith("f1", {
        permissions: [
          { role: "Member", permissionType: "Read" },
          { role: "Vorstand", permissionType: "Write" },
        ],
      })
    );
    expect(
      await screen.findByText("documents.permissionsSaved")
    ).toBeInTheDocument();
  });
});

describe("AdminDocumentsPage — permission chips", () => {
  it("renders a chip per existing permission ('Role: Type')", async () => {
    mockFolderTree([
      makeFolder({
        id: "f1",
        name: "Protocols",
        permissions: [{ role: "Member", permissionType: "Read" }],
      }),
    ]);
    renderWithClient(<AdminDocumentsPage />);
    expect(await screen.findByText("Member: Read")).toBeInTheDocument();
  });

  it("renders the noPermissionsSet hint when a folder has no permissions", async () => {
    mockFolderTree([
      makeFolder({ id: "f1", name: "Protocols", permissions: [] }),
    ]);
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    expect(screen.getByText("documents.noPermissionsSet")).toBeInTheDocument();
  });
});

describe("AdminDocumentsPage — AC-8 delete-folder (styled modal, NOT window.confirm)", () => {
  it("opening delete shows a styled confirmation modal (no window.confirm) with a RED confirm affordance", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    fireEvent.click(screen.getByText("common.delete"));
    // Styled modal title + body appear.
    expect(screen.getByText("documents.deleteFolderTitle")).toBeInTheDocument();
    expect(
      screen.getByText("documents.confirmDeleteFolder")
    ).toBeInTheDocument();
    // window.confirm is NOT used.
    expect(confirmSpy).not.toHaveBeenCalled();
    // The confirm button carries the real RED destructive class (bg-red-600).
    const confirmBtns = screen.getAllByText("common.delete");
    const redConfirm = confirmBtns.find((b) =>
      b.className.includes("bg-red-600")
    );
    expect(redConfirm).toBeTruthy();
    confirmSpy.mockRestore();
  });

  it("confirming delete calls deleteFolder(id) and shows the success banner", async () => {
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    fireEvent.click(screen.getByText("common.delete"));
    const redConfirm = screen
      .getAllByText("common.delete")
      .find((b) => b.className.includes("bg-red-600"))!;
    fireEvent.click(redConfirm);
    await waitFor(() => expect(deleteFolder).toHaveBeenCalledWith("f1"));
    expect(
      await screen.findByText("documents.folderDeleted")
    ).toBeInTheDocument();
  });

  it("on delete FAILURE shows the error AND the modal is already closed (closed before await)", async () => {
    deleteFolder.mockResolvedValue({ success: false, error: "delete-fail" });
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    fireEvent.click(screen.getByText("common.delete"));
    const redConfirm = screen
      .getAllByText("common.delete")
      .find((b) => b.className.includes("bg-red-600"))!;
    fireEvent.click(redConfirm);
    expect(await screen.findByText("delete-fail")).toBeInTheDocument();
    // The styled confirm modal was closed (setDeleteFolderId(null)) BEFORE the
    // deleteFolder await, so on failure the modal is gone but the error shows.
    expect(
      screen.queryByText("documents.deleteFolderTitle")
    ).not.toBeInTheDocument();
  });

  it("cancel closes the delete modal without calling deleteFolder", async () => {
    renderWithClient(<AdminDocumentsPage />);
    await screen.findByText("Protocols");
    fireEvent.click(screen.getByText("common.delete"));
    expect(screen.getByText("documents.deleteFolderTitle")).toBeInTheDocument();
    fireEvent.click(screen.getByText("common.cancel"));
    expect(
      screen.queryByText("documents.deleteFolderTitle")
    ).not.toBeInTheDocument();
    expect(deleteFolder).not.toHaveBeenCalled();
  });
});

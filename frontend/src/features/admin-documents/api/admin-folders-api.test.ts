import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E27-S6: the admin-folders slice api owns the `adminFoldersKeys` factory and
 * WRAPS the shared `@/lib/services/documents` folder transport (DEC-1=A — no URL
 * re-impl, A62 do-not-relocate). These assert the key shapes + that each wrapper
 * delegates to the service with byte-identical args (the god-page's call shape:
 * `getFolders(parentId)` with undefined = root; create/update/delete/permissions
 * forwarded verbatim).
 */

const serviceSpy = vi.hoisted(() => ({
  getFolders: vi.fn(() => Promise.resolve({ success: true, data: [] })),
  createFolder: vi.fn(() => Promise.resolve({ success: true, data: {} })),
  updateFolder: vi.fn(() => Promise.resolve({ success: true, data: {} })),
  deleteFolder: vi.fn(() => Promise.resolve({ success: true, data: {} })),
  setFolderPermissions: vi.fn(() =>
    Promise.resolve({ success: true, data: {} })
  ),
}));
vi.mock("@/lib/services/documents", () => ({
  getFolders: serviceSpy.getFolders,
  createFolder: serviceSpy.createFolder,
  updateFolder: serviceSpy.updateFolder,
  deleteFolder: serviceSpy.deleteFolder,
  setFolderPermissions: serviceSpy.setFolderPermissions,
}));

import {
  DOCUMENT_FOLDERS_BASE,
  adminFoldersKeys,
  fetchFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  setFolderPermissions,
} from "./admin-folders-api";

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin-folders endpoint base", () => {
  it("exposes the byte-identical /api/v1 base", () => {
    expect(DOCUMENT_FOLDERS_BASE).toBe("/api/v1/document-folders");
  });
});

describe("adminFoldersKeys", () => {
  it("exposes the stable key shapes (parentId in the list key, null = root)", () => {
    expect(adminFoldersKeys.all).toEqual(["admin-folders"]);
    expect(adminFoldersKeys.list(undefined)).toEqual([
      "admin-folders",
      "list",
      null,
    ]);
    expect(adminFoldersKeys.list("f1")).toEqual([
      "admin-folders",
      "list",
      "f1",
    ]);
  });
});

describe("folder wrappers delegate to the shared service verbatim", () => {
  it("fetchFolders forwards the parentId (undefined = root)", () => {
    fetchFolders();
    expect(serviceSpy.getFolders).toHaveBeenCalledWith(undefined);
    fetchFolders("f1");
    expect(serviceSpy.getFolders).toHaveBeenCalledWith("f1");
  });

  it("createFolder forwards the request body", () => {
    createFolder({ name: "New", parentFolderId: "p1" });
    expect(serviceSpy.createFolder).toHaveBeenCalledWith({
      name: "New",
      parentFolderId: "p1",
    });
  });

  it("updateFolder forwards id + body", () => {
    updateFolder("f1", { name: "Renamed", sortOrder: 0 });
    expect(serviceSpy.updateFolder).toHaveBeenCalledWith("f1", {
      name: "Renamed",
      sortOrder: 0,
    });
  });

  it("deleteFolder forwards the id", () => {
    deleteFolder("f1");
    expect(serviceSpy.deleteFolder).toHaveBeenCalledWith("f1");
  });

  it("setFolderPermissions forwards id + permissions body", () => {
    setFolderPermissions("f1", {
      permissions: [{ role: "Member", permissionType: "Read" }],
    });
    expect(serviceSpy.setFolderPermissions).toHaveBeenCalledWith("f1", {
      permissions: [{ role: "Member", permissionType: "Read" }],
    });
  });
});

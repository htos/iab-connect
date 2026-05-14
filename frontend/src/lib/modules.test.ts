import { describe, expect, it } from "vitest";
import { resolveModuleForPath } from "./modules";

// REQ-087 (E10-S4): the module → route contract is shared by middleware.ts and Sidebar,
// so its path resolution is unit-tested directly.
describe("resolveModuleForPath", () => {
  it("maps known route prefixes to their owning module", () => {
    expect(resolveModuleForPath("/finance")).toBe("finance");
    expect(resolveModuleForPath("/finance/invoices")).toBe("finance");
    expect(resolveModuleForPath("/members")).toBe("members");
    expect(resolveModuleForPath("/members/segments")).toBe("members");
    expect(resolveModuleForPath("/events/123")).toBe("events");
    expect(resolveModuleForPath("/communication/email-campaigns")).toBe(
      "communication"
    );
    expect(resolveModuleForPath("/sponsors")).toBe("partners");
    expect(resolveModuleForPath("/suppliers")).toBe("partners");
    expect(resolveModuleForPath("/documents")).toBe("documents");
    expect(resolveModuleForPath("/board/documents")).toBe("documents");
  });

  it("resolves /admin/documents to documents without gating the rest of /admin", () => {
    expect(resolveModuleForPath("/admin/documents")).toBe("documents");
    expect(resolveModuleForPath("/admin/documents/42")).toBe("documents");
    expect(resolveModuleForPath("/admin")).toBeNull();
    expect(resolveModuleForPath("/admin/users")).toBeNull();
  });

  it("returns null for non-module paths", () => {
    expect(resolveModuleForPath("/")).toBeNull();
    expect(resolveModuleForPath("/profile")).toBeNull();
    expect(resolveModuleForPath("/financemvp")).toBeNull(); // prefix must be a path boundary
  });
});

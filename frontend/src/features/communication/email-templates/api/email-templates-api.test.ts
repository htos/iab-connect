// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E25-S4: the email-templates slice api owns the query-key factory and WRAPS the
 * `@/features/communication/email-templates/api/email-templates` transport (DEC-1 = A — no URL re-impl). These assert the
 * key shapes (numeric detail id) and that each wrapper delegates to the lib fn
 * with byte-identical args (token forwarded in the lib fn's argument order:
 * `getAllTemplates(token)`, `getTemplateById(id, token)`,
 * `createTemplate(body, token)`, `updateTemplate(id, body, token)`,
 * `deleteTemplate(id, token)`).
 */

const libSpy = vi.hoisted(() => ({
  getAllTemplates: vi.fn(() => Promise.resolve([])),
  getTemplateById: vi.fn(() => Promise.resolve({ id: 1 })),
  createTemplate: vi.fn(() => Promise.resolve({ id: 1 })),
  updateTemplate: vi.fn(() => Promise.resolve({ id: 1 })),
  deleteTemplate: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("@/features/communication/email-templates/api/email-templates", () => ({
  emailTemplatesApi: {
    getAllTemplates: libSpy.getAllTemplates,
    getTemplateById: libSpy.getTemplateById,
    createTemplate: libSpy.createTemplate,
    updateTemplate: libSpy.updateTemplate,
    deleteTemplate: libSpy.deleteTemplate,
  },
}));

import {
  emailTemplatesKeys,
  fetchEmailTemplates,
  fetchEmailTemplate,
  postEmailTemplate,
  putEmailTemplate,
  deleteEmailTemplate,
} from "./email-templates-api";

afterEach(() => vi.clearAllMocks());

describe("emailTemplatesKeys", () => {
  it("exposes the stable key shapes (numeric detail id)", () => {
    expect(emailTemplatesKeys.all).toEqual(["email-templates"]);
    expect(emailTemplatesKeys.list()).toEqual(["email-templates", "list"]);
    expect(emailTemplatesKeys.detail(7)).toEqual([
      "email-templates",
      "detail",
      7,
    ]);
  });
});

describe("wrappers delegate to @/features/communication/email-templates/api/email-templates byte-identically", () => {
  it("fetchEmailTemplates forwards the token", () => {
    fetchEmailTemplates("tok");
    expect(libSpy.getAllTemplates).toHaveBeenCalledWith("tok");
  });

  it("fetchEmailTemplate forwards id + token (numeric id)", () => {
    fetchEmailTemplate("tok", 5);
    expect(libSpy.getTemplateById).toHaveBeenCalledWith(5, "tok");
  });

  it("postEmailTemplate forwards body + token", () => {
    const body = { name: "x" } as never;
    postEmailTemplate("tok", body);
    expect(libSpy.createTemplate).toHaveBeenCalledWith(body, "tok");
  });

  it("putEmailTemplate forwards id + body + token (numeric id)", () => {
    const body = { name: "x" } as never;
    putEmailTemplate("tok", 5, body);
    expect(libSpy.updateTemplate).toHaveBeenCalledWith(5, body, "tok");
  });

  it("deleteEmailTemplate forwards id + token (numeric id)", () => {
    deleteEmailTemplate("tok", 5);
    expect(libSpy.deleteTemplate).toHaveBeenCalledWith(5, "tok");
  });
});

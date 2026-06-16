// E31 boundary-review patch: an EXECUTABLE byte-identity net for the relocated
// `emailTemplatesApi` transport. This is the one transport whose mechanism CHANGED
// in E31 (the class-based `@/lib/api-client` `ApiClient` was retired and inlined
// into a private `request` `fetch` helper here) AND that no other test exercises
// at the real-fetch level (every consumer mocks this module). These tests pin the
// exact URL/verb/header/body/204/error-throw semantics the old `ApiClient`
// produced, so a future edit to the inlined helper cannot silently regress.
import { afterEach, describe, expect, it, vi } from "vitest";
import { emailTemplatesApi } from "./email-templates";

const BASE = "http://localhost:5000";

function okJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("emailTemplatesApi transport (E31 relocation off ApiClient)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getAllTemplates: GET /email-templates with JSON + Bearer headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okJson([{ id: 1 }]));

    const result = await emailTemplatesApi.getAllTemplates("tok");

    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/api/v1/email-templates`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer tok",
      },
    });
    expect(result).toEqual([{ id: 1 }]);
  });

  it("getTemplateById / getTemplatesByCategory compose the path correctly", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => okJson({ id: 7 }));

    await emailTemplatesApi.getTemplateById(7, "tok");
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE}/api/v1/email-templates/7`,
      expect.objectContaining({ method: "GET" })
    );

    await emailTemplatesApi.getTemplatesByCategory("welcome", "tok");
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE}/api/v1/email-templates/category/welcome`,
      expect.objectContaining({ method: "GET" })
    );
  });

  it("createTemplate: POST with JSON-stringified body", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okJson({ id: 1 }));

    await emailTemplatesApi.createTemplate(
      { name: "n", subject: "s", category: "c", htmlBody: "<p/>" } as never,
      "tok"
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/email-templates`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({
        name: "n",
        subject: "s",
        category: "c",
        htmlBody: "<p/>",
      })
    );
  });

  it("updateTemplate: PUT /email-templates/{id} with body", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okJson({ id: 3 }));

    await emailTemplatesApi.updateTemplate(3, { name: "x" } as never, "tok");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/email-templates/3`);
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).body).toBe(JSON.stringify({ name: "x" }));
  });

  it('deactivateTemplate: POST /{id}/deactivate with an EMPTY-object body ("{}")', async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okJson({ id: 5, isActive: false }));

    await emailTemplatesApi.deactivateTemplate(5, "tok");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/email-templates/5/deactivate`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe("{}");
  });

  it("deleteTemplate: DELETE; a 204 resolves to {} (no body parse)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    await expect(emailTemplatesApi.deleteTemplate(9, "tok")).resolves.toEqual(
      {}
    );
  });

  it("omits the Authorization header when no token is given", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okJson([]));

    await emailTemplatesApi.getAllTemplates();

    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toEqual({
      "Content-Type": "application/json",
    });
  });

  it("on a non-OK JSON response, THROWS the parsed error body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okJson({ message: "boom", statusCode: 400 }, 400)
    );

    await expect(
      emailTemplatesApi.getTemplateById(1, "tok")
    ).rejects.toMatchObject({ message: "boom", statusCode: 400 });
  });

  it("on a non-OK non-JSON response, THROWS the fallback {message, statusCode}", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not json", { status: 500 })
    );

    await expect(
      emailTemplatesApi.getTemplateById(1, "tok")
    ).rejects.toMatchObject({
      message: "An unexpected error occurred",
      statusCode: 500,
    });
  });
});

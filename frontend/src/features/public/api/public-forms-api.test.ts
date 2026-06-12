// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmUnsubscribe,
  submitContact,
  subscribeNewsletter,
  unsubscribeByEmail,
  verifyUnsubscribe,
} from "./public-forms-api";

/**
 * E28-S3: public forms transport. Pins the BUILT contact POST (URL + byte-identical
 * payload incl. the honeypot `website`) and confirms the WRAPPED privacy fns are
 * re-exported through the slice (so callers import from the slice, not `lib`).
 */

function stubFetch(
  impl: (url: string, init?: RequestInit) => Partial<Response>
) {
  const mock = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) =>
      impl(String(url), init) as Response
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("public-forms-api", () => {
  it("submitContact → POST /api/v1/public/contact with {name,email,subject,message,website}", async () => {
    const fetchMock = stubFetch(() => ({ ok: true }));
    await submitContact({
      name: "Alice",
      email: "alice@example.com",
      subject: "general",
      message: "Hello",
      website: "",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/public/contact");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Alice",
      email: "alice@example.com",
      subject: "general",
      message: "Hello",
      website: "",
    });
  });

  it("submitContact keeps a filled honeypot website in the payload", async () => {
    const fetchMock = stubFetch(() => ({ ok: true }));
    await submitContact({
      name: "Alice",
      email: "alice@example.com",
      subject: "general",
      message: "Hello",
      website: "i-am-a-bot",
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.website).toBe("i-am-a-bot");
  });

  it("submitContact throws on a non-2xx response", async () => {
    stubFetch(() => ({ ok: false }));
    await expect(
      submitContact({
        name: "x",
        email: "y@z.com",
        subject: "general",
        message: "m",
        website: "",
      })
    ).rejects.toThrow("Request failed");
  });

  it("re-exports the wrapped privacy fns through the slice", () => {
    expect(typeof subscribeNewsletter).toBe("function");
    expect(typeof unsubscribeByEmail).toBe("function");
    expect(typeof verifyUnsubscribe).toBe("function");
    expect(typeof confirmUnsubscribe).toBe("function");
  });
});

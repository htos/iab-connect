import { describe, it, expect } from "vitest";

import {
  DEFAULT_DOCUMENT_HOST,
  getRemotePatternFromEnv,
  parseDocumentHost,
} from "./document-host";

describe("parseDocumentHost", () => {
  it("returns http+9000 for the default dev localhost:9000", () => {
    expect(parseDocumentHost("localhost:9000")).toEqual({
      protocol: "http",
      hostname: "localhost",
      port: "9000",
    });
  });

  it("returns http for 127.0.0.1 host (alt localhost)", () => {
    expect(parseDocumentHost("127.0.0.1:9000")).toEqual({
      protocol: "http",
      hostname: "127.0.0.1",
      port: "9000",
    });
  });

  it("returns https for a bare non-localhost hostname", () => {
    expect(parseDocumentHost("docs.example.app")).toEqual({
      protocol: "https",
      hostname: "docs.example.app",
      port: "",
    });
  });

  it("honors an explicit https:// scheme", () => {
    expect(parseDocumentHost("https://docs.example.app")).toEqual({
      protocol: "https",
      hostname: "docs.example.app",
      port: "",
    });
  });

  it("honors an explicit http:// scheme with a non-localhost host", () => {
    expect(parseDocumentHost("http://cdn.internal.example")).toEqual({
      protocol: "http",
      hostname: "cdn.internal.example",
      port: "",
    });
  });

  it("preserves an explicit port from a full URL", () => {
    expect(parseDocumentHost("http://docs.example.app:8080")).toEqual({
      protocol: "http",
      hostname: "docs.example.app",
      port: "8080",
    });
  });

  it("returns empty port string when no port is provided", () => {
    expect(parseDocumentHost("docs.example.app")).toMatchObject({ port: "" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseDocumentHost("  localhost:9000  ")).toEqual({
      protocol: "http",
      hostname: "localhost",
      port: "9000",
    });
  });

  it("throws TypeError on empty string", () => {
    expect(() => parseDocumentHost("")).toThrow(TypeError);
  });

  it("throws TypeError on whitespace-only string", () => {
    expect(() => parseDocumentHost("   ")).toThrow(TypeError);
  });

  it("throws TypeError on unsupported scheme (ftp)", () => {
    expect(() => parseDocumentHost("ftp://docs.example.app")).toThrow(
      TypeError
    );
  });

  it("throws TypeError on userinfo (user:pass@host)", () => {
    expect(() => parseDocumentHost("user:pass@cdn.example.app")).toThrow(
      /userinfo/i
    );
  });

  it("throws TypeError when a path is provided", () => {
    expect(() =>
      parseDocumentHost("https://cdn.example.app/iabconnect-documents/")
    ).toThrow(/path/i);
  });

  it("throws TypeError when a query string is provided", () => {
    expect(() => parseDocumentHost("docs.example.app?x=1")).toThrow(/query/i);
  });

  it("throws TypeError when a fragment is provided", () => {
    expect(() => parseDocumentHost("docs.example.app#frag")).toThrow(
      /fragment/i
    );
  });

  it("throws TypeError on IPv6 bracket form", () => {
    expect(() => parseDocumentHost("[::1]:9000")).toThrow(/IPv6/i);
  });

  it("wraps URL constructor errors with env-var name breadcrumb", () => {
    // Invalid port surfaces the env-var name and the original cause
    expect(() => parseDocumentHost("localhost:99999")).toThrow(
      /NEXT_PUBLIC_DOCUMENT_HOST/
    );
  });

  it("wraps scheme-only inputs with env-var name breadcrumb", () => {
    expect(() => parseDocumentHost("http://")).toThrow(
      /NEXT_PUBLIC_DOCUMENT_HOST/
    );
  });
});

describe("getRemotePatternFromEnv", () => {
  it("falls back to localhost:9000 when undefined", () => {
    expect(getRemotePatternFromEnv(undefined)).toEqual({
      protocol: "http",
      hostname: "localhost",
      port: "9000",
      pathname: "/**",
    });
  });

  it("falls back to localhost:9000 when empty string", () => {
    expect(getRemotePatternFromEnv("")).toEqual({
      protocol: "http",
      hostname: "localhost",
      port: "9000",
      pathname: "/**",
    });
  });

  it("falls back to localhost:9000 when whitespace-only", () => {
    expect(getRemotePatternFromEnv("   ")).toEqual({
      protocol: "http",
      hostname: "localhost",
      port: "9000",
      pathname: "/**",
    });
  });

  it("uses the value when provided (Beta CDN case)", () => {
    expect(getRemotePatternFromEnv("docs.example.app")).toEqual({
      protocol: "https",
      hostname: "docs.example.app",
      port: "",
      pathname: "/**",
    });
  });

  it("attaches pathname '/**' to every result", () => {
    expect(
      getRemotePatternFromEnv("http://cdn.example.org:9001")
    ).toMatchObject({ pathname: "/**" });
  });
});

describe("DEFAULT_DOCUMENT_HOST", () => {
  it("is exposed as the string 'localhost:9000'", () => {
    expect(DEFAULT_DOCUMENT_HOST).toBe("localhost:9000");
  });
});

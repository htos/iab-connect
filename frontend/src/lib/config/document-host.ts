/**
 * Parses NEXT_PUBLIC_DOCUMENT_HOST into a Next.js images.remotePatterns shape.
 * Build-time only — consumed by next.config.ts. Never read at runtime in client code.
 *
 * Accepted input shapes:
 *   "localhost:9000"               → http://localhost:9000   (dev default — protocol defaults to http for localhost)
 *   "127.0.0.1:9000"               → http://127.0.0.1:9000   (alt localhost)
 *   "docs.example.app"             → https://docs.example.app (non-localhost defaults to https)
 *   "https://docs.example.app"     → https://docs.example.app (explicit scheme honored)
 *   "http://docs.example.app:8080" → http://docs.example.app:8080
 *
 * Rejected (raises TypeError citing the env-var name):
 *   - empty / whitespace-only
 *   - non-http(s) schemes (ftp://, data:, etc.)
 *   - userinfo (user:pass@host) — credentials in URLs are a misconfiguration
 *   - non-root pathname / search / hash — config accepts host-only, not URLs with extra parts
 *   - IPv6 bracket form (URL parser strips brackets, breaking next/image host-matching)
 *   - malformed inputs (invalid ports, missing host, etc.) — rethrown with breadcrumb
 *
 * REQ-088 AC-4 (E11-S3): frontend image host is environment-driven, not hardcoded.
 */

export const DEFAULT_DOCUMENT_HOST = "localhost:9000";

export type DocumentHost = {
  protocol: "http" | "https";
  hostname: string;
  port: string;
};

export type RemotePatternFromEnv = DocumentHost & {
  pathname: "/**";
};

const ENV_VAR_NAME = "NEXT_PUBLIC_DOCUMENT_HOST";

export function parseDocumentHost(value: string): DocumentHost {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TypeError(`${ENV_VAR_NAME} must be a non-empty string`);
  }
  const hasScheme = trimmed.includes("://");
  const candidate = hasScheme ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new TypeError(
      `${ENV_VAR_NAME}=${JSON.stringify(value)} is not a valid host: ${message}`
    );
  }
  if (url.username !== "" || url.password !== "") {
    throw new TypeError(
      `${ENV_VAR_NAME}=${JSON.stringify(value)} must not contain userinfo (user:pass@host) — strip credentials`
    );
  }
  if (url.pathname !== "" && url.pathname !== "/") {
    throw new TypeError(
      `${ENV_VAR_NAME}=${JSON.stringify(value)} must not contain a path — provide host[:port] only`
    );
  }
  if (url.search !== "") {
    throw new TypeError(
      `${ENV_VAR_NAME}=${JSON.stringify(value)} must not contain a query string — provide host[:port] only`
    );
  }
  if (url.hash !== "") {
    throw new TypeError(
      `${ENV_VAR_NAME}=${JSON.stringify(value)} must not contain a fragment — provide host[:port] only`
    );
  }
  if (url.hostname.includes(":")) {
    throw new TypeError(
      `${ENV_VAR_NAME}=${JSON.stringify(value)} appears to be IPv6 (bracket form is stripped by the URL parser, which breaks next/image host-matching) — use a hostname or IPv4 address instead`
    );
  }
  const isLocalhost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  let protocol: "http" | "https";
  if (hasScheme) {
    const scheme = url.protocol.replace(":", "");
    if (scheme !== "http" && scheme !== "https") {
      throw new TypeError(
        `${ENV_VAR_NAME} must use http or https scheme, got "${scheme}"`
      );
    }
    protocol = scheme;
  } else {
    protocol = isLocalhost ? "http" : "https";
  }
  return { protocol, hostname: url.hostname, port: url.port };
}

export function getRemotePatternFromEnv(
  envValue: string | undefined
): RemotePatternFromEnv {
  const host = envValue?.trim() || DEFAULT_DOCUMENT_HOST;
  const parsed = parseDocumentHost(host);
  return { ...parsed, pathname: "/**" };
}

/**
 * Generic service-layer API result wrapper (E31-S1, DEC-2/DEC-4). Relocated
 * verbatim off the retired `the legacy HTTP base`. Shared by the `documents` and
 * `events` slice transports (and their consumers); lives in `@/types` (a lib-leaf)
 * so neither slice owns it and consumers import it without crossing a feature
 * boundary.
 */
export interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
  /**
   * REQ-024 (E3.S4): Parsed JSON body for non-OK responses. Lets endpoint consumers
   * read typed error codes (e.g. `{ message, errorCode: "ShiftFull" }`) without
   * re-parsing `error` string fragments. Undefined on success or when the body
   * was not JSON.
   */
  errorBody?: Record<string, unknown>;
  /** HTTP status code on non-OK responses; undefined on success or transport error. */
  status?: number;
}

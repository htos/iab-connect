// SPDX-License-Identifier: AGPL-3.0-or-later
// E13-S4 AC-8 — contract test for the Railway healthcheckPath endpoint of the `web` service.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";

import { GET } from "./route";

// Project memory A35: explicit afterEach(cleanup) is mandatory in this project even when no
// React render is involved — convention parity with other test files and defense-in-depth
// against future test additions that DO render.
afterEach(cleanup);

describe("GET /api/health (E13-S4)", () => {
  it("returns HTTP 200 with status: ok JSON body", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    // toMatchObject (not toEqual) so additive observability fields — e.g. uptime, gitSha —
    // don't break the contract test. Railway only consumes the 200 status; the body shape
    // beyond `status: "ok"` is informational.
    expect(body).toMatchObject({ status: "ok" });
  });

  it("returns HTTP 200 with a JSON Content-Type", () => {
    const response = GET();

    // Defense-in-depth: re-assert the status here so a future regression that keeps the
    // body shape but flips the status code (e.g. to 500) is caught by this second test
    // independently of the body assertion above.
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
  });
});

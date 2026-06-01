// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const readFileSyncMock = vi.fn();

vi.mock("node:fs", () => ({
  default: { readFileSync: (...args: unknown[]) => readFileSyncMock(...args) },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => {
    const map: Record<string, string> = {
      title: "License",
      body: "IAB Connect is licensed under AGPL-3.0-or-later.",
      viewExternal: "View on gnu.org",
    };
    return map[key] ?? key;
  },
}));

describe("LicensePage", () => {
  beforeEach(() => {
    readFileSyncMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders the LICENSE file content when fs.readFileSync succeeds", async () => {
    readFileSyncMock.mockReturnValue("GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3\n…");
    const { default: LicensePage } = await import("./page");

    const Page = await LicensePage();
    const { container } = render(Page);

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
    expect(container.querySelector("h1")?.textContent).toBe("License");
  });

  test("renders the gnu.org fallback link when fs.readFileSync throws", async () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error("ENOENT: LICENSE file not found");
    });
    // Suppress the expected console.warn during the test.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { default: LicensePage } = await import("./page");
    const Page = await LicensePage();
    const { container } = render(Page);

    expect(container.querySelector("pre")).toBeNull();
    const fallbackLink = container.querySelector(
      'a[href="https://www.gnu.org/licenses/agpl-3.0.txt"]',
    );
    expect(fallbackLink).not.toBeNull();
    expect(fallbackLink?.getAttribute("target")).toBe("_blank");
    expect(fallbackLink?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(warnSpy).toHaveBeenCalled();
  });
});

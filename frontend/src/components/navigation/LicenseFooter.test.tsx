// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LicenseFooter } from "./LicenseFooter";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("LicenseFooter", () => {
  const originalSourceUrl = process.env.NEXT_PUBLIC_SOURCE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SOURCE_URL = "https://github.com/test/fork";
  });

  afterEach(() => {
    cleanup();
    if (originalSourceUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SOURCE_URL;
    } else {
      process.env.NEXT_PUBLIC_SOURCE_URL = originalSourceUrl;
    }
  });

  test("renders the project name", () => {
    render(<LicenseFooter />);
    expect(screen.getByText("projectName")).toBeDefined();
  });

  test("renders the license label as an internal link to /public/license", () => {
    render(<LicenseFooter />);
    const link = screen.getByText("licenseLabel").closest("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/public/license");
  });

  test("renders the source link with the env-overridden URL", () => {
    render(<LicenseFooter />);
    const link = screen.getByText("sourceLabel").closest("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("https://github.com/test/fork");
  });

  test("source link opens in a new tab with security attributes", () => {
    render(<LicenseFooter />);
    const link = screen.getByText("sourceLabel").closest("a");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("is rendered as a footer element with contentinfo role", () => {
    const { container } = render(<LicenseFooter />);
    const footer = container.querySelector("footer");
    expect(footer).not.toBeNull();
    expect(footer?.getAttribute("role")).toBe("contentinfo");
  });

  test("falls back to canonical upstream URL when env var is unset", () => {
    delete process.env.NEXT_PUBLIC_SOURCE_URL;
    render(<LicenseFooter />);
    const link = screen.getByText("sourceLabel").closest("a");
    expect(link?.getAttribute("href")).toBe("https://github.com/htos/iab-connect");
  });
});

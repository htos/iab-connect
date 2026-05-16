// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// next-intl identity translations so assertions can match the key id directly.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Import AFTER vi.mock so the mock is applied at module evaluation time.
import { BetaBanner } from "./BetaBanner";

const ORIGINAL_ENV_LABEL = process.env.NEXT_PUBLIC_ENV_LABEL;
const ORIGINAL_FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL;
const DISMISSED_KEY = "iabc:beta-banner-dismissed";

describe("BetaBanner", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_ENV_LABEL = ORIGINAL_ENV_LABEL;
    process.env.NEXT_PUBLIC_FEEDBACK_URL = ORIGINAL_FEEDBACK_URL;
    window.sessionStorage.clear();
  });

  it("renders the banner when NEXT_PUBLIC_ENV_LABEL=beta", () => {
    process.env.NEXT_PUBLIC_ENV_LABEL = "beta";
    render(<BetaBanner />);
    expect(screen.getByText("bannerMessage")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "ariaLabel");
  });

  it("returns null when NEXT_PUBLIC_ENV_LABEL is unset", () => {
    delete process.env.NEXT_PUBLIC_ENV_LABEL;
    const { container } = render(<BetaBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when NEXT_PUBLIC_ENV_LABEL is not 'beta'", () => {
    process.env.NEXT_PUBLIC_ENV_LABEL = "production";
    const { container } = render(<BetaBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the feedback link with the env-overridden URL", () => {
    process.env.NEXT_PUBLIC_ENV_LABEL = "beta";
    process.env.NEXT_PUBLIC_FEEDBACK_URL = "https://example.test/feedback";
    render(<BetaBanner />);
    const link = screen.getByRole("link", { name: "feedbackLink" });
    expect(link).toHaveAttribute("href", "https://example.test/feedback");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to the GitHub-issue-template URL when NEXT_PUBLIC_FEEDBACK_URL is unset", () => {
    process.env.NEXT_PUBLIC_ENV_LABEL = "beta";
    delete process.env.NEXT_PUBLIC_FEEDBACK_URL;
    render(<BetaBanner />);
    const link = screen.getByRole("link", { name: "feedbackLink" });
    expect(link.getAttribute("href")).toContain("github.com/htos/iab-connect");
    expect(link.getAttribute("href")).toContain("template=beta-feedback.md");
  });

  it("hides the banner and persists the dismiss flag when dismissed", () => {
    process.env.NEXT_PUBLIC_ENV_LABEL = "beta";
    const { container } = render(<BetaBanner />);
    const dismissButton = screen.getByRole("button", { name: "dismissAriaLabel" });
    fireEvent.click(dismissButton);
    expect(container.firstChild).toBeNull();
    expect(window.sessionStorage.getItem(DISMISSED_KEY)).toBe("1");
  });

  it("stays hidden after re-render when the dismiss flag is already set", () => {
    process.env.NEXT_PUBLIC_ENV_LABEL = "beta";
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
    const { container } = render(<BetaBanner />);
    // useEffect runs after first render, so we need a microtask tick. React Testing
    // Library's render call awaits the effect for us — assert via the container.
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});

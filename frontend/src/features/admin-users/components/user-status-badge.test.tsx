// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { UserStatusBadge, userStatusClass } from "./user-status-badge";

// A77: the enabled/disabled colours + the emailVerified ✓ marker are copied
// VERBATIM from the god-page status cell; pinned here. Identity translator.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

afterEach(cleanup);

describe("userStatusClass", () => {
  it("maps enabled to green and disabled to red", () => {
    expect(userStatusClass(true)).toBe("bg-green-100 text-green-800");
    expect(userStatusClass(false)).toBe("bg-red-100 text-red-800");
  });
});

describe("UserStatusBadge", () => {
  it("renders the active (green) badge with the ✓ when verified", () => {
    render(<UserStatusBadge enabled emailVerified />);
    const badge = screen.getByText("active");
    expect(badge).toHaveClass("bg-green-100");
    expect(badge).toHaveClass("text-green-800");
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("renders the inactive (red) badge with no ✓ when not verified", () => {
    render(<UserStatusBadge enabled={false} emailVerified={false} />);
    const badge = screen.getByText("inactive");
    expect(badge).toHaveClass("bg-red-100");
    expect(badge).toHaveClass("text-red-800");
    expect(screen.queryByText("✓")).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

// REQ-028 (E5-S3) AC-4/AC-7: detail page renders status-conditional lifecycle buttons and calls
// the right lifecycle helper; recent-execution panel degrades to "no runs yet".

// React 19 `use(promise)` — resolve synchronously (mirrors the fees-page test).
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react");
  return {
    ...actual,
    use: (input: unknown) => {
      const thenable = input as { then?: (cb: (v: unknown) => void) => void };
      if (thenable && typeof thenable.then === "function") {
        let resolved: unknown;
        thenable.then((v) => (resolved = v));
        return resolved;
      }
      return (actual.use as unknown as (x: unknown) => unknown)(input);
    },
  };
});

function syncThenable<T>(value: T): Promise<T> {
  return { then: (cb: (v: T) => void) => cb(value) } as unknown as Promise<T>;
}

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    isAdmin: false,
    isVorstand: true,
    accessToken: "test-token",
  }),
}));

const getAutomation = vi.fn();
const getExecutions = vi.fn().mockResolvedValue([]);
const changeAutomationStatus = vi.fn();

vi.mock("@/lib/api/automations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/automations")>(
    "@/lib/api/automations"
  );
  return {
    ...actual,
    getAutomation: (...a: unknown[]) => getAutomation(...a),
    getExecutions: (...a: unknown[]) => getExecutions(...a),
    changeAutomationStatus: (...a: unknown[]) => changeAutomationStatus(...a),
  };
});

import AutomationDetailPage from "./page";

function detail(status: string) {
  return {
    id: "abc",
    name: "Welcome journey",
    description: null,
    status,
    trigger: { type: "MemberJoined", offsetDays: null },
    templateId: 1,
    templateName: "Welcome template",
    segmentType: "AllActiveMembers",
    segmentFilter: null,
    consentFilter: null,
    createdById: "u",
    createdByName: "tester",
    createdAt: "2026-06-06T10:00:00Z",
    updatedAt: null,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AutomationDetailPage", () => {
  it("shows Pause + Disable for an Active automation (not Activate/Resume)", async () => {
    getAutomation.mockResolvedValue(detail("Active"));
    render(<AutomationDetailPage params={syncThenable({ id: "abc" })} />);

    await waitFor(() =>
      expect(screen.getByText("Welcome journey")).toBeInTheDocument()
    );
    expect(screen.getByText("pause")).toBeInTheDocument();
    expect(screen.getByText("disable")).toBeInTheDocument();
    expect(screen.queryByText("activate")).not.toBeInTheDocument();
    expect(screen.queryByText("resume")).not.toBeInTheDocument();
  });

  it("shows Activate for a Draft automation and calls the lifecycle helper", async () => {
    getAutomation.mockResolvedValue(detail("Draft"));
    changeAutomationStatus.mockResolvedValue(detail("Active"));
    render(<AutomationDetailPage params={syncThenable({ id: "abc" })} />);

    await waitFor(() =>
      expect(screen.getByText("activate")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("activate"));

    await waitFor(() =>
      expect(changeAutomationStatus).toHaveBeenCalledWith(
        "test-token",
        "abc",
        "activate"
      )
    );
  });

  it("shows Resume for a Paused automation", async () => {
    getAutomation.mockResolvedValue(detail("Paused"));
    render(<AutomationDetailPage params={syncThenable({ id: "abc" })} />);

    await waitFor(() => expect(screen.getByText("resume")).toBeInTheDocument());
    expect(screen.queryByText("pause")).not.toBeInTheDocument();
  });

  it("degrades to 'no runs yet' when there are no executions", async () => {
    getAutomation.mockResolvedValue(detail("Active"));
    getExecutions.mockResolvedValue([]);
    render(<AutomationDetailPage params={syncThenable({ id: "abc" })} />);

    await waitFor(() =>
      expect(screen.getByText("noRunsYet")).toBeInTheDocument()
    );
  });
});

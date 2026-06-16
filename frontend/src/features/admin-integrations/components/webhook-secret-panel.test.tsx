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

/**
 * E27-S5: the show-once webhook signing-secret panel (behaviour-LOCKED, data-loss
 * path, create-only). Same mechanism as the api-client panel: render once, copy via
 * clipboard.writeText (flip copy→copied, NO timer), dismiss → onDismiss.
 */

const tFn = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => tFn }));

import { WebhookSecretPanel } from "./webhook-secret-panel";

const created = {
  id: "9",
  name: "New",
  targetUrl: "https://n.example.com/h",
  eventTypes: ["event.created"],
  secret: "iabc-webhook-SECRET",
  createdAt: "2026-06-07T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WebhookSecretPanel", () => {
  it("renders the warning + the signing secret once", () => {
    render(<WebhookSecretPanel secret={created} onDismiss={vi.fn()} />);
    expect(screen.getByText("secretOnceWarning")).toBeInTheDocument();
    expect(screen.getByText("iabc-webhook-SECRET")).toBeInTheDocument();
  });

  it("copies the signing secret and flips copy -> copied (no timer)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<WebhookSecretPanel secret={created} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText("copy"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("iabc-webhook-SECRET")
    );
    expect(screen.getByText("copied")).toBeInTheDocument();
    expect(screen.queryByText("copy")).not.toBeInTheDocument();
  });

  it("invokes onDismiss when dismissed", () => {
    const onDismiss = vi.fn();
    render(<WebhookSecretPanel secret={created} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText("dismissSecret"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

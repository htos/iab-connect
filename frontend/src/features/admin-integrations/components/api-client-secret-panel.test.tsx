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
 * E27-S5: the show-once api-client secret panel (behaviour-LOCKED, data-loss path).
 * Pins: the cleartext renders once in a <code>; Copy → clipboard.writeText(secret)
 * then flips copy→copied (NO timer); Dismiss → calls onDismiss (the parent clears
 * `createdSecret`, the ONLY source of the cleartext). The translator is a module-level
 * stable identity (A78).
 */

const tFn = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => tFn }));

import { ApiClientSecretPanel } from "./api-client-secret-panel";

const created = {
  id: "9",
  name: "New",
  scopes: ["events:read"],
  secret: "iabc.abc.SECRETVALUE",
  createdAt: "2026-06-07T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ApiClientSecretPanel", () => {
  it("renders the warning + the cleartext secret once", () => {
    render(<ApiClientSecretPanel secret={created} onDismiss={vi.fn()} />);
    expect(screen.getByText("secretOnceWarning")).toBeInTheDocument();
    expect(screen.getByText("iabc.abc.SECRETVALUE")).toBeInTheDocument();
    expect(screen.getByText("copy")).toBeInTheDocument();
  });

  it("copies the secret via clipboard and flips copy -> copied (no timer)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ApiClientSecretPanel secret={created} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText("copy"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("iabc.abc.SECRETVALUE")
    );
    expect(screen.getByText("copied")).toBeInTheDocument();
    // No timer flips it back: the label stays "copied".
    expect(screen.queryByText("copy")).not.toBeInTheDocument();
  });

  it("invokes onDismiss when the dismiss link is clicked", () => {
    const onDismiss = vi.fn();
    render(<ApiClientSecretPanel secret={created} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText("dismissSecret"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

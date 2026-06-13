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

// REQ-030 (E5-S5) AC-7: the Channel Preferences card renders the current preference + available
// channels, a change calls the helper → refresh → success message, and a disabled channel is shown
// unavailable.
//
// E29-S4 relocation: moved with the component into the profile slice. The card is
// behaviour-identical; it now reaches the channel fns via the slice `api/profile-api`
// wrappers (which forward to `@/features/profile/api/privacy-consent` byte-identically), so this mock of
// `@/features/profile/api/privacy-consent` STILL intercepts. Only the import (named export from the new
// path) changed; all three assertions are unchanged.

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

const getChannelPreference = vi.fn();
const updateChannelPreference = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/profile/api/privacy-consent", () => ({
  getChannelPreference: (...a: unknown[]) => getChannelPreference(...a),
  updateChannelPreference: (...a: unknown[]) => updateChannelPreference(...a),
}));

import { ChannelPreferencesCard } from "./channel-preferences-card";

function pref(preferred = "Email") {
  return {
    preferredChannel: preferred,
    availableChannels: [
      { channel: "Email", isEnabled: true },
      { channel: "Sms", isEnabled: false },
    ],
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChannelPreferencesCard", () => {
  it("renders the current preference and available channels", async () => {
    getChannelPreference.mockResolvedValue(pref("Email"));
    render(<ChannelPreferencesCard />);

    await waitFor(() =>
      expect(
        screen.getByText("channelPreferences.channel.Email")
      ).toBeInTheDocument()
    );
    expect(
      screen.getByText("channelPreferences.channel.Sms")
    ).toBeInTheDocument();
    // disabled channel shows the "coming soon" hint
    expect(
      screen.getByText("channelPreferences.comingSoon")
    ).toBeInTheDocument();
  });

  it("disables the radio for an unavailable channel", async () => {
    getChannelPreference.mockResolvedValue(pref("Email"));
    render(<ChannelPreferencesCard />);

    await waitFor(() =>
      expect(
        screen.getByText("channelPreferences.channel.Sms")
      ).toBeInTheDocument()
    );
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    // Email enabled, Sms disabled
    expect(radios[0].disabled).toBe(false);
    expect(radios[1].disabled).toBe(true);
  });

  it("saves a change via the helper and shows a success message", async () => {
    // start with Sms enabled so a change to it is selectable
    getChannelPreference.mockResolvedValue({
      preferredChannel: "Email",
      availableChannels: [
        { channel: "Email", isEnabled: true },
        { channel: "Sms", isEnabled: true },
      ],
    });
    render(<ChannelPreferencesCard />);

    await waitFor(() =>
      expect(
        screen.getByText("channelPreferences.channel.Sms")
      ).toBeInTheDocument()
    );
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    fireEvent.click(radios[1]); // choose Sms

    await waitFor(() =>
      expect(updateChannelPreference).toHaveBeenCalledWith("test-token", "Sms")
    );
    await waitFor(() =>
      expect(screen.getByText("channelPreferences.saved")).toBeInTheDocument()
    );
  });
});

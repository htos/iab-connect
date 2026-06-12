// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * E27-S3: behaviour invariants of the RHF+Zod `BrandingSettingsForm` (DEC-2). Pins the
 * hex/email `.refine` validation (blank is VALID → saved as null), the A96 no-trim
 * mapping (submitted bytes preserved; blank optional fields → null), `<form
 * noValidate>` surfacing per-field errors, and the logo type/size allowlist driving
 * the inline `logoInvalid` sub-state. The page-level save flow (PUT + logo POST +
 * refreshAppSettings) is pinned by the E27-S1 app-page net.
 */

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { BrandingSettingsForm } from "./branding-settings-form";
import type { BrandingSettingsValues } from "../schemas/admin-settings.schema";

const DEFAULTS: BrandingSettingsValues = {
  applicationName: "Acme Verein",
  logoText: "AV",
  logoBackgroundColor: "#123456",
  logoTextColor: "#ffffff",
  description: "",
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  primaryColor: "",
  publicSiteEnabled: true,
};

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock-logo");
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderForm(
  props: Partial<React.ComponentProps<typeof BrandingSettingsForm>> = {}
) {
  const onSubmit = vi.fn();
  const { container } = render(
    <BrandingSettingsForm
      defaultValues={DEFAULTS}
      currentLogoUrl={null}
      onSubmit={onSubmit}
      pending={false}
      message={null}
      logoFailed={false}
      {...props}
    />
  );
  return { onSubmit, container };
}

describe("BrandingSettingsForm", () => {
  it("submits the mapped request with blank optional fields → null (A96 no-trim)", async () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByText("saveSettings"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [body, logoFile] = onSubmit.mock.calls[0];
    expect(body).toMatchObject({
      applicationName: "Acme Verein",
      logoText: "AV",
      logoBackgroundColor: "#123456",
      // blank optional fields stored as null ("not configured").
      description: null,
      contactEmail: null,
      primaryColor: null,
      publicSiteEnabled: true,
    });
    expect(logoFile).toBeNull();
  });

  it("rejects an invalid primaryColor hex with the field error (blank stays valid)", async () => {
    const { onSubmit } = renderForm({
      defaultValues: { ...DEFAULTS, primaryColor: "nothex" },
    });
    fireEvent.click(screen.getByText("saveSettings"));

    await waitFor(() => {
      expect(screen.getByText("primaryColorInvalid")).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an invalid contactEmail with the field error", async () => {
    const { onSubmit } = renderForm({
      defaultValues: { ...DEFAULTS, contactEmail: "not-an-email" },
    });
    fireEvent.click(screen.getByText("saveSettings"));

    await waitFor(() => {
      expect(screen.getByText("contactEmailInvalid")).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts a valid hex + email and submits them byte-identical (no trim)", async () => {
    const { onSubmit } = renderForm({
      defaultValues: {
        ...DEFAULTS,
        primaryColor: "#abcdef",
        contactEmail: "info@acme.example",
      },
    });
    fireEvent.click(screen.getByText("saveSettings"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      primaryColor: "#abcdef",
      contactEmail: "info@acme.example",
    });
  });

  it("rejects an invalid logo file type inline (allowlist)", () => {
    const { container } = renderForm();
    const fileInput = container.querySelector(
      "#logoUpload"
    ) as HTMLInputElement;
    const bad = new File(["x"], "logo.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [bad] } });
    expect(screen.getByText("logoInvalid")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SupplierStatusBadge } from "./supplier-status-badge";
import type { SupplierStatus } from "../types/supplier.types";

// E21-S3 / DEC-2: status colours come from the shared Badge primitive's token
// variants — never raw Tailwind colour classes in the feature.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

afterEach(cleanup);

describe("SupplierStatusBadge", () => {
  it("renders the translated status label", () => {
    render(<SupplierStatusBadge status="Active" />);
    expect(screen.getByText("suppliers.status.Active")).toBeInTheDocument();
  });

  it.each([
    ["Active", "bg-primary"],
    ["Prospect", "bg-secondary"],
    ["Paused", "text-foreground"], // outline variant
    ["Ended", "bg-destructive"],
  ] as [SupplierStatus, string][])(
    "maps %s onto the %s token variant",
    (status, expectedClass) => {
      render(<SupplierStatusBadge status={status} />);
      expect(screen.getByText(`suppliers.status.${status}`)).toHaveClass(
        expectedClass
      );
    }
  );
});

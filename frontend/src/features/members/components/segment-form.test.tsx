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
import { SegmentForm } from "./segment-form";
import { SegmentType } from "../types/member-segment.types";
import type { SegmentFormValues } from "../schemas/segment.schema";
import type { SegmentCriteria } from "../types/member-segment.types";

/**
 * E23-S4: focused tests for the shared RHF+Zod `SegmentForm`. The S1 new/edit
 * characterization suites cover the create/update→redirect + error-banner paths
 * end-to-end; this file pins the Zod required-`name` validation (the A79 delta the
 * manual god-pages did not enforce) and the create-mode criteria-serialisation
 * contract (Dynamic → criteriaJson string; Static → undefined).
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const EMPTY_VALUES: SegmentFormValues = {
  name: "",
  description: "",
  segmentType: SegmentType.Static,
  color: "orange",
  isActive: true,
};

const EMPTY_CRITERIA: SegmentCriteria = {
  status: [],
  type: [],
  memberSince: {},
  city: "",
  country: "",
};

function renderForm(
  overrides: Partial<React.ComponentProps<typeof SegmentForm>> = {}
) {
  const props: React.ComponentProps<typeof SegmentForm> = {
    mode: "create",
    defaultValues: EMPTY_VALUES,
    defaultCriteria: EMPTY_CRITERIA,
    onSubmit: vi.fn(),
    onPreview: vi.fn(),
    preview: null,
    previewing: false,
    submitIdleLabel: "segments.action.create",
    submitPendingLabel: "common.saving",
    pending: false,
    errorMessage: null,
    cancelHref: "/members/segments",
    ...overrides,
  };
  return { props, ...render(<SegmentForm {...props} />) };
}

afterEach(cleanup);

describe("SegmentForm (form sub-recipe)", () => {
  it("renders the API error banner when errorMessage is set", () => {
    renderForm({ errorMessage: "Something went wrong" });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("disables the submit button and shows the saving label while pending", () => {
    renderForm({ pending: true });
    expect(
      screen.getByRole("button", { name: "common.saving" })
    ).toBeDisabled();
  });

  it("blocks submit and shows a required error when name is empty (Zod)", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    fireEvent.click(
      screen.getByRole("button", { name: "segments.action.create" })
    );

    expect(await screen.findByText("form.required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a Static segment with undefined criteriaJson", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    fireEvent.change(screen.getByLabelText(/segments\.field\.name/), {
      target: { value: "Board" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "segments.action.create" })
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Board" }),
        undefined
      )
    );
  });

  it("submits a Dynamic segment with a serialised criteriaJson string", async () => {
    const onSubmit = vi.fn();
    renderForm({
      onSubmit,
      defaultValues: { ...EMPTY_VALUES, segmentType: SegmentType.Dynamic },
    });

    fireEvent.change(screen.getByLabelText(/segments\.field\.name/), {
      target: { value: "Active Members" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "segments.action.create" })
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const criteriaJson = onSubmit.mock.calls[0][1] as string;
    expect(typeof criteriaJson).toBe("string");
    expect(() => JSON.parse(criteriaJson)).not.toThrow();
  });

  it("renders type as read-only text (no combobox) in edit mode", () => {
    renderForm({ mode: "edit", defaultValues: EMPTY_VALUES });
    expect(screen.getByText("segments.typeNotEditable")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

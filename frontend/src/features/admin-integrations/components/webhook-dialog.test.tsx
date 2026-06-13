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
 * E27-S5: behaviour invariants of the shared RHF+Zod `WebhookDialog` (DEC-2). Pins:
 *   - the save-disabled gate parity (name + targetUrl + >=1 event type), computed live;
 *   - A98 mode-divergent surfaces (title differs; submit label SAME);
 *   - the checkboxes render ONLY for availableEventTypes (a stored legacy type is NOT
 *     a checkbox), but A95: a no-touch edit save round-trips the seeded eventTypes;
 *   - the submit body shape `{ name, targetUrl, eventTypes }`.
 * The translator is module-level stable (A78).
 */

const tFn = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => tFn }));

import { WebhookDialog } from "./webhook-dialog";

const availableEventTypes = ["event.created", "payment.received"];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WebhookDialog", () => {
  it("shows the create title in create mode and keeps the save label as t('save')", () => {
    render(
      <WebhookDialog
        mode="create"
        defaultValues={{ name: "", targetUrl: "", eventTypes: [] }}
        availableEventTypes={availableEventTypes}
        saving={false}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("createDialogTitle")).toBeInTheDocument();
    expect(screen.queryByText("editDialogTitle")).not.toBeInTheDocument();
    expect(screen.getByText("save")).toBeInTheDocument();
  });

  it("shows the edit title in edit mode but the SAME save label (A98)", () => {
    render(
      <WebhookDialog
        mode="edit"
        defaultValues={{
          name: "Hook",
          targetUrl: "https://h",
          eventTypes: ["event.created"],
        }}
        availableEventTypes={availableEventTypes}
        saving={false}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("editDialogTitle")).toBeInTheDocument();
    expect(screen.getByText("save")).toBeInTheDocument();
  });

  it("keeps save disabled until name, targetUrl and >=1 event type are all set", () => {
    render(
      <WebhookDialog
        mode="create"
        defaultValues={{ name: "", targetUrl: "", eventTypes: [] }}
        availableEventTypes={availableEventTypes}
        saving={false}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );
    const saveBtn = screen.getByText("save").closest("button")!;
    expect(saveBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "New" },
    });
    expect(saveBtn).toBeDisabled(); // missing targetUrl + event type

    fireEvent.change(screen.getByPlaceholderText("https://"), {
      target: { value: "https://n.example.com/h" },
    });
    expect(saveBtn).toBeDisabled(); // missing >=1 event type

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(saveBtn).toBeEnabled();
  });

  it("renders checkboxes ONLY for availableEventTypes (a legacy stored type is not a checkbox)", () => {
    render(
      <WebhookDialog
        mode="edit"
        defaultValues={{
          name: "Legacy Hook",
          targetUrl: "https://legacy.example.com/h",
          eventTypes: ["legacy.retired.type"],
        }}
        availableEventTypes={availableEventTypes}
        saving={false}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(
      availableEventTypes.length
    );
    expect(screen.queryByText("legacy.retired.type")).not.toBeInTheDocument();
  });

  it("round-trips the seeded eventTypes verbatim on a no-touch edit save (A95)", async () => {
    const onSave = vi.fn();
    render(
      <WebhookDialog
        mode="edit"
        defaultValues={{
          name: "Legacy Hook",
          targetUrl: "https://legacy.example.com/h",
          eventTypes: ["legacy.retired.type"],
        }}
        availableEventTypes={availableEventTypes}
        saving={false}
        onCancel={vi.fn()}
        onSave={onSave}
      />
    );
    // Save without touching the event-type selection.
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toEqual({
      name: "Legacy Hook",
      targetUrl: "https://legacy.example.com/h",
      eventTypes: ["legacy.retired.type"],
    });
  });

  it("pre-fills the name + targetUrl from defaultValues on edit", () => {
    render(
      <WebhookDialog
        mode="edit"
        defaultValues={{
          name: "Editable Hook",
          targetUrl: "https://e.example.com/h",
          eventTypes: ["event.created"],
        }}
        availableEventTypes={availableEventTypes}
        saving={false}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("Editable Hook")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://e.example.com/h")
    ).toBeInTheDocument();
  });

  it("submits the body shape { name, targetUrl, eventTypes } byte-identical", async () => {
    const onSave = vi.fn();
    render(
      <WebhookDialog
        mode="create"
        defaultValues={{ name: "", targetUrl: "", eventTypes: [] }}
        availableEventTypes={availableEventTypes}
        saving={false}
        onCancel={vi.fn()}
        onSave={onSave}
      />
    );
    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "New" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://"), {
      target: { value: "https://n.example.com/h" },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toEqual({
      name: "New",
      targetUrl: "https://n.example.com/h",
      eventTypes: ["event.created"],
    });
  });
});

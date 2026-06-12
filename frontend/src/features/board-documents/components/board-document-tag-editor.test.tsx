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
import { BoardDocumentTagEditor } from "./board-document-tag-editor";

/**
 * E29-S3 form sub-recipe (DEC-2 = A): focused tests for the RHF+Zod tag editor.
 * The S1 detail characterization suite already covers the edit→save→refetch path
 * end-to-end; this pins the editor's own contract: the Edit/Cancel toggle, the
 * view-mode pill list / `documents.noTags` empty state, and the behaviour-
 * preserving comma-list PARSING the god-page's `handleSaveTags` did (split, trim,
 * drop empties) — the free-text list stays unvalidated (god-page parity).
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

afterEach(cleanup);

describe("BoardDocumentTagEditor (form sub-recipe)", () => {
  it("renders the existing tags as pills in view mode", () => {
    render(
      <BoardDocumentTagEditor tags={["legal", "board"]} onSave={vi.fn()} />
    );
    expect(screen.getByText("legal")).toBeInTheDocument();
    expect(screen.getByText("board")).toBeInTheDocument();
  });

  it("shows the no-tags empty state when there are no tags", () => {
    render(<BoardDocumentTagEditor tags={[]} onSave={vi.fn()} />);
    expect(screen.getByText("documents.noTags")).toBeInTheDocument();
  });

  it("toggles into edit mode, parses the comma list, and saves the trimmed array", async () => {
    const onSave = vi.fn();
    render(<BoardDocumentTagEditor tags={["legal"]} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    const input = screen.getByPlaceholderText("documents.tagsPlaceholder");
    fireEvent.change(input, { target: { value: " alpha ,  beta , ,gamma" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(["alpha", "beta", "gamma"])
    );
  });

  it("a free-text empty input saves an empty array (no validation, god-page parity)", async () => {
    const onSave = vi.fn();
    render(<BoardDocumentTagEditor tags={["legal"]} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    fireEvent.change(screen.getByPlaceholderText("documents.tagsPlaceholder"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([]));
  });

  it("stays in edit mode with the typed text intact when onSave rejects (E29 review P3)", async () => {
    // god-page parity: `setEditingTags(false)` ran only on `result.success`. A
    // rejecting save must keep the editor open so the user's edit is not lost.
    const onSave = vi.fn().mockRejectedValue(new Error("save failed"));
    render(<BoardDocumentTagEditor tags={["legal"]} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    const input = screen.getByPlaceholderText(
      "documents.tagsPlaceholder"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "alpha, beta" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(["alpha", "beta"]));
    // still in edit mode — the input persists with the user's text
    const stillEditing = screen.getByPlaceholderText(
      "documents.tagsPlaceholder"
    ) as HTMLInputElement;
    expect(stillEditing).toBeInTheDocument();
    expect(stillEditing.value).toBe("alpha, beta");
  });

  it("Cancel exits edit mode without saving", () => {
    const onSave = vi.fn();
    render(<BoardDocumentTagEditor tags={["legal"]} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    expect(
      screen.getByPlaceholderText("documents.tagsPlaceholder")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(
      screen.queryByPlaceholderText("documents.tagsPlaceholder")
    ).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

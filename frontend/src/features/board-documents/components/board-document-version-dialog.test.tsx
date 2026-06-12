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
import { BoardDocumentVersionDialog } from "./board-document-version-dialog";

/**
 * E29 review (P2): the version dialog must NOT wipe the chosen file + typed
 * comment on the ERROR path. The parent keeps the dialog OPEN on failure (it
 * closes only in `onSuccess`), so the file/comment clear only when the dialog
 * closes — god-page parity (`setVersionFile(null)` ran only after a successful
 * upload).
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

vi.mock("@/lib/services/documents", () => ({
  formatFileSize: (n: number) => `${n} B`,
}));

afterEach(cleanup);

function chooseFile(name = "v3.pdf") {
  const file = new File(["x"], name, { type: "application/pdf" });
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
  return file;
}

describe("BoardDocumentVersionDialog (E29 review P2)", () => {
  it("keeps the chosen file + typed comment while the dialog stays open (upload failure)", async () => {
    const onSubmit = vi.fn();
    render(
      <BoardDocumentVersionDialog
        open
        pending={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const file = chooseFile("v3.pdf");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "minor fix" },
    });
    fireEvent.click(screen.getByRole("button", { name: "documents.upload" }));

    // RHF handleSubmit is async.
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ file, comment: "minor fix" })
    );
    // dialog still open (failure) → file + comment intact, NOT wiped.
    expect(screen.getByText("v3.pdf")).toBeInTheDocument();
    expect(screen.getByDisplayValue("minor fix")).toBeInTheDocument();
  });

  it("resets the file + comment once the dialog closes", () => {
    const { rerender } = render(
      <BoardDocumentVersionDialog
        open
        pending={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    chooseFile("v3.pdf");
    expect(screen.getByText("v3.pdf")).toBeInTheDocument();

    rerender(
      <BoardDocumentVersionDialog
        open={false}
        pending={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    rerender(
      <BoardDocumentVersionDialog
        open
        pending={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.queryByText("v3.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("documents.chooseFile")).toBeInTheDocument();
  });
});

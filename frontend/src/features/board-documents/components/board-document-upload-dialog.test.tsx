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
import { BoardDocumentUploadDialog } from "./board-document-upload-dialog";

/**
 * E29 review (P1): the upload dialog must NOT wipe the chosen file + typed
 * metadata on the ERROR path. The parent fires the upload mutation and keeps the
 * dialog OPEN on failure (it closes only in `onSuccess`), so the file/fields are
 * cleared only when the dialog closes — god-page parity (`setUploadFile(null)`
 * ran only after a successful upload).
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// Keep the real DocumentCategory enum (re-exported via the types module) +
// formatFileSize; only the surface needs the module present.
vi.mock("@/types/documents", async () => {
  const actual = await vi.importActual<typeof import("@/types/documents")>(
    "@/types/documents"
  );
  return { ...actual, formatFileSize: (n: number) => `${n} B` };
});

afterEach(cleanup);

function chooseFile(name = "policy.pdf") {
  const file = new File(["x"], name, { type: "application/pdf" });
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
  return file;
}

describe("BoardDocumentUploadDialog (E29 review P1)", () => {
  it("keeps the chosen file + typed name while the dialog stays open (upload failure)", async () => {
    const onSubmit = vi.fn();
    render(
      <BoardDocumentUploadDialog
        open
        pending={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    chooseFile("policy.pdf");
    fireEvent.change(screen.getByDisplayValue("policy"), {
      target: { value: "My Policy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "documents.upload" }));

    // the parent received the submit (RHF handleSubmit is async)…
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My Policy" })
      )
    );
    // …and because the dialog is still open (failure), the file name + the typed
    // name are still on screen (NOT wiped synchronously).
    expect(screen.getByText("policy.pdf")).toBeInTheDocument();
    expect(screen.getByDisplayValue("My Policy")).toBeInTheDocument();
  });

  it("resets the file + fields once the dialog closes (success → parent unmounts content)", () => {
    const { rerender } = render(
      <BoardDocumentUploadDialog
        open
        pending={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    chooseFile("policy.pdf");
    expect(screen.getByText("policy.pdf")).toBeInTheDocument();

    // parent closes the dialog (its onSuccess) …
    rerender(
      <BoardDocumentUploadDialog
        open={false}
        pending={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    // …and re-opens it: the previous file is gone (clean slate).
    rerender(
      <BoardDocumentUploadDialog
        open
        pending={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.queryByText("policy.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("documents.chooseFile")).toBeInTheDocument();
  });
});

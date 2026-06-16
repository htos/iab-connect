// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * E25-S4: behaviour invariants of the shared RHF+Zod `EmailTemplateForm` (DEC-2).
 * The S1 new/edit characterization suites already cover the create/update→success→
 * redirect + error paths end-to-end with the REAL form; this file pins the form's
 * OWN behaviour: the props contract (`template?`/`onSave`/`isSaving`), the
 * values→payload mapping (incl. the default html/text content + the variables
 * array), the variables-array add/remove sub-editor, the category select, and the
 * NEW Zod required-field validation that blocks submit (the A79 delta the old
 * HTML5-only form did not enforce under `fireEvent`).
 */

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

// Stub the TipTap editor (a controlled textarea) so content edits are assertable.
vi.mock("@/components/ui/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    onChange,
  }: {
    content: string;
    onChange: (c: string) => void;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { EmailTemplateForm } from "./email-template-form";
import type { EmailTemplate } from "../types/email-template.types";

function makeTemplate(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id: 5,
    name: "Welcome",
    subject: "Welcome aboard",
    htmlContent: "<p>Hi</p>",
    textContent: "Hi",
    category: "Welcome",
    description: "Greeting",
    version: 1,
    isActive: true,
    variables: [],
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("EmailTemplateForm (form sub-recipe)", () => {
  it("disables the submit button and shows the saving label while isSaving", () => {
    render(<EmailTemplateForm onSave={vi.fn()} isSaving={true} />);
    expect(screen.getByRole("button", { name: "saving" })).toBeDisabled();
  });

  it("prefills the inputs from the template prop", () => {
    render(<EmailTemplateForm template={makeTemplate()} onSave={vi.fn()} />);
    expect(
      (screen.getByPlaceholderText("namePlaceholder") as HTMLInputElement).value
    ).toBe("Welcome");
    expect(
      (screen.getByPlaceholderText("subjectPlaceholder") as HTMLInputElement)
        .value
    ).toBe("Welcome aboard");
  });

  it("blocks submit and shows a required error when name is empty (Zod)", async () => {
    const onSave = vi.fn();
    render(<EmailTemplateForm onSave={onSave} />);

    // subject filled, name left empty → Zod blocks submit.
    fireEvent.change(screen.getByPlaceholderText("subjectPlaceholder"), {
      target: { value: "Subj" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(await screen.findByText("form.required")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave with the mapped payload incl. the default html/text + variables", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EmailTemplateForm onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "My Template" },
    });
    fireEvent.change(screen.getByPlaceholderText("subjectPlaceholder"), {
      target: { value: "My Subject" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: "My Template",
      subject: "My Subject",
      category: "Custom",
      htmlContent: "<p>Hallo {{name}},</p>",
      textContent: "Hallo {{name}},",
      variables: [],
    });
  });

  it("sends the RAW untrimmed name/subject to onSave (no .trim() transform — byte-identical payload)", async () => {
    // Regression for the Patch-1 fix: the schema must NOT `.trim()` name/subject,
    // otherwise RHF's resolver would mutate the resolved value and onSave would
    // receive a trimmed payload — diverging from the god-page, which sent the raw
    // formData verbatim.
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EmailTemplateForm onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "  Welcome  " },
    });
    fireEvent.change(screen.getByPlaceholderText("subjectPlaceholder"), {
      target: { value: "  Hello World  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: "  Welcome  ",
      subject: "  Hello World  ",
    });
  });

  it("adds a variable to the payload via the variables sub-editor", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EmailTemplateForm onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "N" },
    });
    fireEvent.change(screen.getByPlaceholderText("subjectPlaceholder"), {
      target: { value: "S" },
    });
    fireEvent.change(screen.getByPlaceholderText("variableNamePlaceholder"), {
      target: { value: "firstName" },
    });
    fireEvent.click(screen.getByRole("button", { name: "addVariable" }));

    // the variable is rendered as `{{firstName}}` in the list
    expect(screen.getByText("{{firstName}}")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].variables).toEqual([
      {
        name: "firstName",
        description: "",
        defaultValue: "",
        isRequired: false,
      },
    ]);
  });

  it("removes a variable from the editor", () => {
    render(
      <EmailTemplateForm
        template={makeTemplate({
          variables: [
            {
              name: "firstName",
              description: "First",
              isRequired: false,
            },
          ],
        })}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText("{{firstName}}")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "remove" }));
    expect(screen.queryByText("{{firstName}}")).not.toBeInTheDocument();
  });

  it("renders the category select options", () => {
    render(<EmailTemplateForm onSave={vi.fn()} />);
    // a few of the EMAIL_TEMPLATE_CATEGORIES options
    expect(screen.getByRole("option", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Custom" })).toBeInTheDocument();
  });
});

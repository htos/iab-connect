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
import { EventForm } from "./event-form";
import { EventCategory, EventVisibility } from "../types/events.types";
import type { EventFormValues } from "../schemas/event.schema";

/**
 * E24-S2: focused tests for the shared RHF+Zod `EventForm` (the E22 form
 * sub-recipe applied to Events). The new/edit characterization suites cover the
 * create/update→redirect + error-banner paths end-to-end; this file pins the
 * Zod required-field validation (the A79 delta the manual form did not enforce)
 * and the submit-payload conversion (tags split, ISO-UTC dates,
 * registrationDeadline omission).
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

const EMPTY: EventFormValues = {
  title: "",
  description: "",
  location: "",
  startDate: "",
  endDate: "",
  shortDescription: "",
  locationAddress: "",
  locationUrl: "",
  isAllDay: false,
  timeZone: "Europe/Zurich",
  maxParticipants: undefined,
  registrationRequired: false,
  registrationDeadline: "",
  waitlistEnabled: false,
  visibility: EventVisibility.MembersOnly,
  category: EventCategory.General,
  tags: [],
  imageUrl: "",
  imageAltText: "",
  organizerName: "",
  contactEmail: "",
  contactPhone: "",
  cost: undefined,
  costDescription: "",
  contentLanguage: "",
};

function renderForm(
  overrides?: Partial<React.ComponentProps<typeof EventForm>>
) {
  const onSubmit = vi.fn();
  render(
    <EventForm
      defaultValues={EMPTY}
      defaultTagsInput=""
      onSubmit={onSubmit}
      submitLabel="actions.create"
      pendingLabel="actions.creating"
      pending={false}
      errorMessage={null}
      cancelHref="/events"
      {...overrides}
    />
  );
  return { onSubmit };
}

function fillRequired() {
  fireEvent.change(document.querySelector('input[name="title"]')!, {
    target: { value: "My Event" },
  });
  fireEvent.change(document.querySelector('textarea[name="description"]')!, {
    target: { value: "Desc" },
  });
  fireEvent.change(document.querySelector('input[name="location"]')!, {
    target: { value: "Zurich" },
  });
  fireEvent.change(document.querySelector('input[name="startDate"]')!, {
    target: { value: "2026-07-01T10:00" },
  });
  fireEvent.change(document.querySelector('input[name="endDate"]')!, {
    target: { value: "2026-07-01T12:00" },
  });
}

afterEach(cleanup);

describe("EventForm (form sub-recipe)", () => {
  it("renders the API error banner when errorMessage is set", () => {
    renderForm({ errorMessage: "Something went wrong" });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("disables the submit button and shows the pending label while pending", () => {
    renderForm({ pending: true });
    expect(
      screen.getByRole("button", { name: "actions.creating" })
    ).toBeDisabled();
  });

  it("blocks submit and shows required errors when required fields are empty (Zod)", async () => {
    const { onSubmit } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "actions.create" }));

    expect(
      (await screen.findAllByText("form.required")).length
    ).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with the converted payload (tags array, ISO-UTC dates, no blank deadline)", async () => {
    const { onSubmit } = renderForm();

    fillRequired();
    fireEvent.change(document.querySelector("#tags")!, {
      target: { value: " a , b ,, c " },
    });

    fireEvent.click(screen.getByRole("button", { name: "actions.create" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.title).toBe("My Event");
    expect(payload.tags).toEqual(["a", "b", "c"]);
    expect(payload.startDate).toBe(new Date("2026-07-01T10:00").toISOString());
    expect(payload.endDate).toBe(new Date("2026-07-01T12:00").toISOString());
    // Blank registration deadline → omitted (undefined).
    expect(payload.registrationDeadline).toBeUndefined();
  });
});

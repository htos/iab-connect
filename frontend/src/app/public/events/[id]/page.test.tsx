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
 * REQ-022 (E4-S3) AC-1/AC-3 fee rendering + E28-S1 characterization extension —
 * ADAPTED to RSC in E28-S2 (A88/A79). The page flipped client→async Server
 * Component reading `params` as a prop (was `useParams`); the read-only display is
 * server-rendered and the stateful registration block is the
 * `<EventRegistrationForm>` client island (manual state preserved — NOT RHF). The
 * fee section stays mounted through the page so the REQ-022 specs stay green. The
 * harness adapts `render(<Page/>)` → `render(await Page({ params }))` + mocks BOTH
 * `next-intl/server` `getTranslations` (the SC) and `next-intl` `useTranslations`
 * (the island).
 *
 * Principal A79 delta: the client loading-spinner test is removed (RSC awaits the
 * fetch before rendering).
 */

vi.mock("next-intl/server", () => ({
  getTranslations: async (_ns?: string) => {
    return (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${JSON.stringify(vars)}` : key;
  },
}));

// Stable translator for the client island.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

import PublicEventDetailPage from "./page";

const params = Promise.resolve({ id: "evt-1" });

const baseEvent = {
  id: "evt-1",
  title: "Paid Workshop",
  description: "A workshop",
  location: "Hall",
  startDate: "2099-01-01T10:00:00Z",
  endDate: "2099-01-01T12:00:00Z",
  isAllDay: false,
  registrationRequired: true,
  waitlistEnabled: false,
  visibility: "Public",
  status: "Published",
  category: "Workshop",
  tags: [] as string[],
  isFree: false,
  cost: 25,
  hasStarted: false,
  hasEnded: false,
  isRegistrationOpen: true,
};

type AnyEvent = Record<string, unknown>;

function setupFetch(opts: {
  event?: AnyEvent;
  eventOk?: boolean;
  eventStatus?: number;
  fees?: unknown[];
  postResult?: AnyEvent;
}) {
  const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/registrations/public")) {
      return Promise.resolve({
        ok: true,
        json: async () => opts.postResult ?? { isWaitlisted: false },
      } as Response);
    }
    if (u.endsWith("/fee-categories")) {
      return Promise.resolve({
        ok: true,
        json: async () => opts.fees ?? [],
      } as Response);
    }
    return Promise.resolve({
      ok: opts.eventOk ?? true,
      status: opts.eventStatus ?? 200,
      json: async () => opts.event ?? baseEvent,
      text: async () => "",
    } as Response);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PublicEventDetailPage fee rendering (RSC-adapted)", () => {
  it("renders a single applicable fee category", async () => {
    setupFetch({
      fees: [{ id: "f1", name: "Adult", amount: 25, currency: "CHF" }],
    });
    render(await PublicEventDetailPage({ params }));

    expect(screen.getByText("fee.sectionTitle")).toBeInTheDocument();
    expect(screen.getByText(/Adult/)).toBeInTheDocument();
    // single fee → no radio inputs
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("renders radios when multiple fee categories apply", async () => {
    setupFetch({
      fees: [
        { id: "f1", name: "Adult", amount: 25, currency: "CHF" },
        { id: "f2", name: "Child", amount: 10, currency: "CHF" },
      ],
    });
    render(await PublicEventDetailPage({ params }));

    expect(screen.getByText("fee.sectionTitle")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText(/Adult/)).toBeInTheDocument();
    expect(screen.getByText(/Child/)).toBeInTheDocument();
  });

  it("shows no fee section for a free event (no applicable categories)", async () => {
    setupFetch({ fees: [] });
    render(await PublicEventDetailPage({ params }));

    expect(screen.getByText("registration")).toBeInTheDocument();
    expect(screen.queryByText("fee.sectionTitle")).not.toBeInTheDocument();
  });
});

describe("PublicEventDetailPage (E28-S1 characterization extension, RSC-adapted)", () => {
  it("renders the generic error block (no distinct 404) with a back link on fetch failure", async () => {
    setupFetch({ eventOk: false, eventStatus: 500 });
    render(await PublicEventDetailPage({ params }));
    expect(screen.getByText("errorTitle")).toBeInTheDocument();
    const back = screen.getByRole("link", { name: /backToEvents/ });
    expect(back.getAttribute("href")).toBe("/public/events");
  });

  it("shows the registrationClosed notice when registration is not open", async () => {
    setupFetch({ event: { ...baseEvent, isRegistrationOpen: false } });
    render(await PublicEventDetailPage({ params }));
    expect(screen.getByText("registrationClosed")).toBeInTheDocument();
  });

  it("submits the registration and shows the success outcome", async () => {
    setupFetch({ fees: [], postResult: { isWaitlisted: false } });
    render(await PublicEventDetailPage({ params }));

    fireEvent.change(screen.getByLabelText(/formName/), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/formEmail/), {
      target: { value: "john@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "register" }));

    await waitFor(() =>
      expect(screen.getByText("registrationSuccess")).toBeInTheDocument()
    );
  });

  it("shows the waitlist success outcome with the returned position", async () => {
    setupFetch({
      fees: [],
      postResult: { isWaitlisted: true, waitlistPosition: 3 },
    });
    render(await PublicEventDetailPage({ params }));

    fireEvent.change(screen.getByLabelText(/formName/), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/formEmail/), {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "register" }));

    await waitFor(() =>
      expect(
        screen.getByText('registration.waitlistSuccess {"position":3}')
      ).toBeInTheDocument()
    );
  });

  it("shows the paid fee.amountDue notice on a successful paid registration", async () => {
    setupFetch({
      fees: [{ id: "f1", name: "Adult", amount: 25, currency: "CHF" }],
      postResult: { isWaitlisted: false },
    });
    render(await PublicEventDetailPage({ params }));

    fireEvent.change(screen.getByLabelText(/formName/), {
      target: { value: "Paid" },
    });
    fireEvent.change(screen.getByLabelText(/formEmail/), {
      target: { value: "paid@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "register" }));

    await waitFor(() =>
      expect(screen.getByText(/fee\.amountDue/)).toBeInTheDocument()
    );
  });

  it("POSTs the registration payload with the expected key set", async () => {
    const fetchMock = setupFetch({
      fees: [{ id: "f1", name: "Adult", amount: 25, currency: "CHF" }],
      postResult: { isWaitlisted: false },
    });
    render(await PublicEventDetailPage({ params }));

    fireEvent.change(screen.getByLabelText(/formName/), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/formEmail/), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/formPhone/), {
      target: { value: "0791234567" },
    });
    fireEvent.change(screen.getByLabelText(/formGuests/), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/formRequirements/), {
      target: { value: "Vegan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "register" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([u]) =>
        String(u).endsWith("/registrations/public")
      );
      expect(post).toBeTruthy();
    });
    const post = fetchMock.mock.calls.find(([u]) =>
      String(u).endsWith("/registrations/public")
    )!;
    const init = post[1] as RequestInit;
    expect(String(post[0])).toContain(
      "/api/v1/events/evt-1/registrations/public"
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "John",
      email: "john@example.com",
      phone: "0791234567",
      numberOfGuests: 2,
      specialRequirements: "Vegan",
      feeCategoryId: "f1",
    });
  });
});

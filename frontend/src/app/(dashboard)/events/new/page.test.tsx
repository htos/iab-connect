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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// E24-S2 characterization tests for the NEW event page, ADAPTED to the feature
// slice (RHF+Zod `EventForm` + `useCreateEvent` TanStack mutation).
//
// PRESERVED behavioural OUTCOMES (the S1 regression oracle):
//   - manager-only gate: forbidden alert for non-managers, NO create request;
//   - conditional field toggles (isAllDay date-type, registrationRequired reveal);
//   - the cost field is exposed;
//   - submit POSTs /api/v1/events with tags split→trim→filter, ISO-UTC dates,
//     and registrationDeadline OMITTED when blank; then navigates to /events/{id};
//   - error surfaces (failure banner; no navigation).
//
// CHANGED mechanisms (intended A79 deltas):
//   - transport: raw `fetch` spy → `useApiClient().post` spy ({data,error,status});
//   - form: manual `useState` → RHF+Zod (so the banner text is now the mutation
//     error message, i.e. the apiClient `error` string, not a `t()` key mapping);
//   - field selectors: inputs are registered by RHF — text/textarea fields keep
//     their `name` attributes; the tags input is still `#tags` (id-only).

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
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

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

// @/lib/auth: stable mutable auth object + stable apiClient spy (DEC-1 contract).
const auth = {
  isAuthenticated: true,
  isLoading: false,
  accessToken: "test-token",
  isAdmin: false,
  isVorstand: true,
};
const apiPost = vi.fn();
const apiClient = {
  get: vi.fn(),
  post: apiPost,
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => auth,
  useApiClient: () => apiClient,
}));

import NewEventPage from "./page";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <NewEventPage />
    </QueryClientProvider>
  );
}

// Fill the minimum required form fields (title, description, location, startDate, endDate).
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

beforeEach(() => {
  auth.isVorstand = true;
  auth.isAdmin = false;
  auth.accessToken = "test-token";
  apiPost.mockResolvedValue({
    data: { id: "evt-99" },
    error: null,
    status: 201,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NewEventPage (slice)", () => {
  it("renders the forbidden alert for a non-manager and fires no request", () => {
    auth.isVorstand = false;
    auth.isAdmin = false;

    renderPage();

    expect(screen.getByText("errors.noPermission")).toBeInTheDocument();
    expect(screen.getByText("errors.noPermissionCreate")).toBeInTheDocument();
    // Back-to-events link present; the create form is not.
    expect(screen.getByText("actions.backToEvents")).toBeInTheDocument();
    expect(document.querySelector('input[name="title"]')).toBeNull();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("renders the create form for a manager", () => {
    renderPage();
    expect(document.querySelector('input[name="title"]')).toBeTruthy();
    expect(screen.getByText("createEvent")).toBeInTheDocument();
  });

  it("toggles the all-day field type between datetime-local and date", () => {
    renderPage();
    const start = document.querySelector(
      'input[name="startDate"]'
    ) as HTMLInputElement;
    expect(start.type).toBe("datetime-local");

    fireEvent.click(document.querySelector('input[name="isAllDay"]')!);
    expect(
      (document.querySelector('input[name="startDate"]') as HTMLInputElement)
        .type
    ).toBe("date");
  });

  it("reveals registration sub-fields only when registrationRequired is on", () => {
    renderPage();
    expect(document.querySelector('input[name="maxParticipants"]')).toBeNull();

    fireEvent.click(
      document.querySelector('input[name="registrationRequired"]')!
    );
    expect(
      document.querySelector('input[name="maxParticipants"]')
    ).toBeTruthy();
    expect(
      document.querySelector('input[name="waitlistEnabled"]')
    ).toBeTruthy();
  });

  it("exposes the cost field", () => {
    renderPage();
    expect(document.querySelector('input[name="cost"]')).toBeTruthy();
  });

  it("POSTs /api/v1/events with tags split/trimmed and ISO-UTC dates, then navigates", async () => {
    renderPage();
    fillRequired();
    // Tags: comma-split, trimmed, empties filtered. The tags input has only an id, no name.
    fireEvent.change(document.querySelector("#tags")!, {
      target: { value: " a , b ,, c " },
    });

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    const [url, body] = apiPost.mock.calls[0];
    expect(url).toBe("/api/v1/events");
    expect(body.tags).toEqual(["a", "b", "c"]);
    // datetime-local strings converted to ISO-UTC (Z suffix).
    expect(body.startDate).toBe(new Date("2026-07-01T10:00").toISOString());
    expect(body.endDate).toBe(new Date("2026-07-01T12:00").toISOString());
    // No registration deadline entered → undefined (dropped from the body).
    expect(body.registrationDeadline).toBeUndefined();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/events/evt-99"));
  });

  it("surfaces the failure banner when the POST returns an error", async () => {
    // The apiClient never throws (DEC-1) — it returns an `error` string which the
    // create mutation rethrows; the form banner shows that message.
    apiPost.mockResolvedValue({
      data: undefined,
      error: "errors.createFailed",
      status: 500,
    });

    renderPage();
    fillRequired();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() =>
      expect(screen.getByText("errors.createFailed")).toBeInTheDocument()
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces the server message when the POST returns an error with a message", async () => {
    apiPost.mockResolvedValue({ data: undefined, error: "Boom", status: 400 });

    renderPage();
    fillRequired();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => expect(screen.getByText("Boom")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces the failure banner when the POST rejects (network throw)", async () => {
    // Mechanism change: the god-page caught a `fetch` reject and showed
    // `errors.networkError`; here the mutation's rejection message is the banner.
    apiPost.mockRejectedValue(new Error("errors.networkError"));

    renderPage();
    fillRequired();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() =>
      expect(screen.getByText("errors.networkError")).toBeInTheDocument()
    );
    expect(push).not.toHaveBeenCalled();
  });
});

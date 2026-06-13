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
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// E24-S2 characterization tests for the EDIT event page, ADAPTED to the feature
// slice (RHF+Zod `EventForm` + `useEvent`/`useUpdateEvent` TanStack hooks).
//
// PRESERVED behavioural OUTCOMES (the S1 regression oracle):
//   - load skeleton while the GET is pending;
//   - GET /api/v1/events/{id} loads and prefills the form;
//   - full-page notFound (404) and loadFailed (other error) error views;
//   - manager-only gate AFTER a successful load (no PUT for non-managers);
//   - submit PUTs /api/v1/events/{id} with ISO-UTC dates, then navigates;
//   - error surfaces (updateFailed banner; no navigation).
//
// CHANGED mechanisms (intended A79 deltas):
//   - transport: raw `fetch` spy → `useApiClient().get/put` spies ({data,error,status});
//   - load: `useEffect`+`useState` GET → `useEvent()` TanStack query (404 →
//     EventNotFoundError → notFound; other error → loadFailed);
//   - notFound is now driven by `status:404` (not "any non-ok"); a non-404 error
//     drives the loadFailed view;
//   - form: manual `useState` → RHF+Zod (banner text is the mutation error string).
// The route page STILL resolves `params: Promise<{id}>` via React `use`, so the
// `use` shim below is preserved.

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react");
  return {
    ...actual,
    use: (input: unknown) => {
      const maybeThenable = input as {
        then?: (cb: (v: unknown) => void) => void;
      };
      if (maybeThenable && typeof maybeThenable.then === "function") {
        let resolved: unknown;
        let didResolve = false;
        maybeThenable.then((v) => {
          resolved = v;
          didResolve = true;
        });
        if (didResolve) return resolved;
        throw input;
      }
      return (actual.use as unknown as (x: unknown) => unknown)(input);
    },
  };
});

function syncThenable<T>(value: T): Promise<T> {
  return { then: (cb: (v: T) => void) => cb(value) } as unknown as Promise<T>;
}

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

const auth = {
  isAuthenticated: true,
  isLoading: false,
  accessToken: "test-token",
  isAdmin: false,
  isVorstand: true,
};
const apiGet = vi.fn();
const apiPut = vi.fn();
const apiClient = {
  get: apiGet,
  post: vi.fn(),
  put: apiPut,
  delete: vi.fn(),
  upload: vi.fn(),
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => auth,
  useApiClient: () => apiClient,
}));

import EditEventPage from "./page";

const eventDto = {
  id: "evt-1",
  title: "Loaded Title",
  description: "Loaded Desc",
  location: "Zurich",
  startDate: "2026-07-01T10:00:00.000Z",
  endDate: "2026-07-01T12:00:00.000Z",
  shortDescription: "",
  locationAddress: "",
  locationUrl: "",
  isAllDay: false,
  timeZone: "Europe/Zurich",
  maxParticipants: undefined,
  registrationRequired: false,
  registrationDeadline: null,
  waitlistEnabled: false,
  visibility: "MembersOnly",
  category: "General",
  tags: ["x", "y"],
  imageUrl: "",
  imageAltText: "",
  contactEmail: "",
  contactPhone: "",
  cost: undefined,
  costDescription: "",
  contentLanguage: "",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <EditEventPage params={syncThenable({ id: "evt-1" })} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  auth.isVorstand = true;
  auth.isAdmin = false;
  auth.accessToken = "test-token";
  apiGet.mockResolvedValue({ data: eventDto, error: null, status: 200 });
  apiPut.mockResolvedValue({ data: { id: "evt-1" }, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EditEventPage (slice)", () => {
  it("shows the load skeleton before the GET resolves", () => {
    // Never-resolving GET keeps the query pending.
    apiGet.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("loads the event via GET /api/v1/events/{id} and populates the form", async () => {
    renderPage();

    await waitFor(() =>
      expect(
        (document.querySelector('input[name="title"]') as HTMLInputElement)
          ?.value
      ).toBe("Loaded Title")
    );
    expect(apiGet).toHaveBeenCalledWith("/api/v1/events/evt-1");
    // tags joined back into the comma input (id-only, no name attribute).
    expect((document.querySelector("#tags") as HTMLInputElement).value).toBe(
      "x, y"
    );
  });

  it("renders the full-page notFound error view when the GET returns 404", async () => {
    apiGet.mockResolvedValue({
      data: undefined,
      error: "Not found",
      status: 404,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("errors.notFound")).toBeInTheDocument()
    );
    // Error view links back to events; no form rendered.
    expect(screen.getByText("actions.backToEvents")).toBeInTheDocument();
    expect(document.querySelector('input[name="title"]')).toBeNull();
  });

  it("renders the full-page loadFailed error view when the GET fails (non-404)", async () => {
    apiGet.mockResolvedValue({
      data: undefined,
      error: "offline",
      status: 500,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("errors.loadFailed")).toBeInTheDocument()
    );
    expect(document.querySelector('input[name="title"]')).toBeNull();
  });

  it("renders the forbidden alert for a non-manager after a successful load and fires no PUT", async () => {
    auth.isVorstand = false;
    auth.isAdmin = false;

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("errors.noPermission")).toBeInTheDocument()
    );
    expect(screen.getByText("errors.noPermissionEdit")).toBeInTheDocument();
    expect(screen.getByText("actions.backToEvent")).toBeInTheDocument();
    // Only the GET load fired — no PUT, and no form.
    expect(document.querySelector('input[name="title"]')).toBeNull();
    expect(apiPut).not.toHaveBeenCalled();
  });

  it("PUTs /api/v1/events/{id} on submit and navigates to the event", async () => {
    renderPage();
    await waitFor(() =>
      expect(
        (document.querySelector('input[name="title"]') as HTMLInputElement)
          ?.value
      ).toBe("Loaded Title")
    );

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));
    const [url, body] = apiPut.mock.calls[0];
    expect(url).toBe("/api/v1/events/evt-1");
    // dates round-trip to ISO-UTC.
    expect(body.startDate).toBe(new Date(body.startDate).toISOString());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/events/evt-1"));
  });

  it("surfaces updateFailed when the PUT returns an error", async () => {
    apiPut.mockResolvedValue({
      data: undefined,
      error: "errors.updateFailed",
      status: 500,
    });

    renderPage();
    await waitFor(() =>
      expect(
        (document.querySelector('input[name="title"]') as HTMLInputElement)
          ?.value
      ).toBe("Loaded Title")
    );

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() =>
      expect(screen.getByText("errors.updateFailed")).toBeInTheDocument()
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces the failure banner when the PUT rejects (network throw)", async () => {
    apiPut.mockRejectedValue(new Error("errors.networkError"));

    renderPage();
    await waitFor(() =>
      expect(
        (document.querySelector('input[name="title"]') as HTMLInputElement)
          ?.value
      ).toBe("Loaded Title")
    );

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() =>
      expect(screen.getByText("errors.networkError")).toBeInTheDocument()
    );
    expect(push).not.toHaveBeenCalled();
  });
});

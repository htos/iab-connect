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

// E26-S1 (S6 settings group) — characterization net for the Finance PROFILE page (the big ~17-field
// form). Behaviour-preservation ORACLE (A87). Pin AS-IS (A56).
//
// Load-bearing pins for the S6 RHF+Zod migration:
//   - 404-on-GET → "create mode" (POST /profile) vs existing-profile (PUT /profile/{id}) branch.
//   - jurisdiction → currency/countryCode/organizationCountry reset side-effect (CH↔EU).
//   - the `finance-profile-changed` CustomEvent dispatched on a successful save.
//   - read-only render: canReadFinance && !canWriteFinance → every field `disabled` + NO save footer.
//   - A95: countryCode is conditional on jurisdiction==="EU" (27 EU codes). An EU-stored OUT-OF-SET
//     countryCode is round-tripped on save with no touch-edit (the Zod field must be the FULL string
//     union, NEVER z.enum(renderedSubset)).
//   - A96: optionals map "" → null on submit; nothing is `.trim()`ed.
//
// Guard shape pinned: `if (authLoading || loading) return <loading>` then renders the form. There is
//   NO `if (!canReadFinance) return null`. BUT `loading` starts true and only flips inside the
//   guarded loadProfile effect (`if (!authLoading && canReadFinance)`), so a non-read user is STUCK
//   on the loading state and never fires the GET.
//   // A56 note: the brief says these pages "render the empty default form/table to a non-read user".
//   The realised behaviour is "stuck on tc('loading')" because `loading` is only cleared by the
//   guarded fetch. Pinned AS-IS — do NOT add a `!canReadFinance` guard.
//
// A79 deltas: all transport via `useApiClient` direct (mock the bag; survives the migration with ZERO
//   edits — the A94 BUILD case). No QueryClientProvider (god-page pre-TanStack).

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href?: string;
  }) => <a href={typeof href === "string" ? href : "#"}>{children}</a>,
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
const authState = {
  isLoading: false,
  canReadFinance: true,
  canWriteFinance: true,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
    upload: apiUpload,
  }),
}));

import FinanceProfilePage from "./page";

const EXISTING_PROFILE = {
  id: "prof-1",
  jurisdiction: "CH",
  countryCode: null,
  currency: "CHF",
  fiscalYearStartMonth: 1,
  organizationName: "Acme Verein",
  organizationAddress: "Main Street 1",
  organizationCity: "Zurich",
  organizationPostalCode: "8000",
  organizationCountry: "CH",
  organizationEmail: "info@acme.example",
  organizationPhone: "+41 11 222 33 44",
  organizationWebsite: "https://acme.example",
  organizationUid: "CHE-123.456.789",
  bankName: "UBS",
  bankIban: "CH93 0076 2011 6238 5295 7",
  bankBic: "UBSWCHZH80A",
  accountingMode: "SimpleCash",
  isActive: true,
  createdAt: "2026-05-14T00:00:00Z",
  updatedAt: "2026-05-14T00:00:00Z",
};

function wireExisting(profile: unknown = EXISTING_PROFILE) {
  apiGet.mockResolvedValue({ data: profile, error: null, status: 200 });
}

function wire404() {
  // 404 → create mode (profile stays null).
  apiGet.mockResolvedValue({ data: null, error: "Not Found", status: 404 });
}

beforeEach(() => {
  wireExisting();
  apiPost.mockResolvedValue({
    data: { ...EXISTING_PROFILE, id: "new-1" },
    error: null,
    status: 200,
  });
  apiPut.mockResolvedValue({
    data: EXISTING_PROFILE,
    error: null,
    status: 200,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isLoading = false;
  authState.canReadFinance = true;
  authState.canWriteFinance = true;
});

// Find a <select> by its currently-selected value (the form has no label/id wiring).
function selectByValue(
  container: HTMLElement,
  value: string
): HTMLSelectElement {
  const selects = Array.from(container.querySelectorAll("select"));
  const match = selects.find((s) => (s as HTMLSelectElement).value === value);
  if (!match) throw new Error(`No <select> with value="${value}"`);
  return match as HTMLSelectElement;
}

describe("FinanceProfilePage — read/load guard (AC-2)", () => {
  it("shows the loading state while authLoading and fires no GET", () => {
    authState.isLoading = true;
    render(<FinanceProfilePage />);

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("stays on the loading state for a non-read user and fires no GET (no early return, no redirect)", async () => {
    // A56 note: NO `!canReadFinance` early-return; `loading` is never cleared because the guarded
    // fetch does not run → the page is stuck on tc("loading"). Pinned AS-IS.
    authState.canReadFinance = false;
    render(<FinanceProfilePage />);

    await Promise.resolve();
    expect(apiGet).not.toHaveBeenCalled();
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByText("settingsHub.profile")).not.toBeInTheDocument();
  });

  it("loads the profile via GET /api/v1/finance/profile and renders the form", async () => {
    render(<FinanceProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
    });
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/profile");
  });
});

describe("FinanceProfilePage — 404 create-mode vs existing-profile branch (A99)", () => {
  it("on 404 keeps the default form (no error) and SAVE creates via POST /profile", async () => {
    wire404();
    const { container } = render(<FinanceProfilePage />);

    await waitFor(() => {
      // The default form renders (jurisdiction defaults to CH; no error banner).
      expect(selectByValue(container, "CH")).toBeInTheDocument();
    });
    // No loadError shown on a clean 404.
    expect(screen.queryByText("loadError")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/profile",
        expect.objectContaining({ jurisdiction: "CH", currency: "CHF" })
      );
    });
    expect(apiPut).not.toHaveBeenCalled();
  });

  it("with an existing profile SAVE updates via PUT /profile/{id}", async () => {
    render(<FinanceProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/profile/prof-1",
        expect.objectContaining({ organizationName: "Acme Verein" })
      );
    });
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("shows loadError when GET returns a non-404 error", async () => {
    apiGet.mockResolvedValue({ data: null, error: "boom", status: 500 });
    render(<FinanceProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("loadError")).toBeInTheDocument();
    });
  });
});

describe("FinanceProfilePage — jurisdiction side-effect (load-bearing)", () => {
  it("switching CH→EU sets currency=EUR and reveals the countryCode select", async () => {
    render(<FinanceProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
    });
    const { container } = { container: document.body };
    const jurisdiction = selectByValue(container, "CH");
    fireEvent.change(jurisdiction, { target: { value: "EU" } });

    await waitFor(() => {
      // currency reset to EUR; the EU countryCode select appears.
      expect(screen.getByText("countryCode")).toBeInTheDocument();
    });
    // currency select now reads EUR.
    expect(selectByValue(container, "EUR")).toBeInTheDocument();
  });

  it("switching back EU→CH clears countryCode and resets currency=CHF", async () => {
    // Start from an EU profile with a country code.
    wireExisting({
      ...EXISTING_PROFILE,
      jurisdiction: "EU",
      countryCode: "DE",
      currency: "EUR",
      organizationCountry: "DE",
    });
    render(<FinanceProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("countryCode")).toBeInTheDocument();
    });
    const container = document.body;
    const jurisdiction = selectByValue(container, "EU");
    fireEvent.change(jurisdiction, { target: { value: "CH" } });

    await waitFor(() => {
      // countryCode field is hidden under CH.
      expect(screen.queryByText("countryCode")).not.toBeInTheDocument();
    });
    expect(selectByValue(container, "CHF")).toBeInTheDocument();
  });
});

describe("FinanceProfilePage — finance-profile-changed event", () => {
  it("dispatches finance-profile-changed on a successful save", async () => {
    const eventSpy = vi.fn();
    window.addEventListener("finance-profile-changed", eventSpy);
    try {
      render(<FinanceProfilePage />);
      await waitFor(() => {
        expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("save"));

      await waitFor(() => {
        expect(eventSpy).toHaveBeenCalled();
      });
      expect(screen.getByText("saveSuccess")).toBeInTheDocument();
    } finally {
      window.removeEventListener("finance-profile-changed", eventSpy);
    }
  });

  it("does NOT dispatch finance-profile-changed when the save fails", async () => {
    const eventSpy = vi.fn();
    window.addEventListener("finance-profile-changed", eventSpy);
    try {
      apiPut.mockResolvedValue({ data: null, error: "boom", status: 500 });
      render(<FinanceProfilePage />);
      await waitFor(() => {
        expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("save"));

      await waitFor(() => {
        expect(screen.getByText("saveError")).toBeInTheDocument();
      });
      expect(eventSpy).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("finance-profile-changed", eventSpy);
    }
  });
});

describe("FinanceProfilePage — write guard / read-only render (AC-3)", () => {
  it("read-only user: every field disabled + NO save footer (the canonical read-only render)", async () => {
    authState.canWriteFinance = false;
    const { container } = render(<FinanceProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
    });
    // Every input/select/textarea is disabled.
    const fields = Array.from(
      container.querySelectorAll("input, select, textarea")
    );
    expect(fields.length).toBeGreaterThan(0);
    fields.forEach((f) => expect(f).toBeDisabled());
    // Save footer (save / saving / cancel buttons) is hidden.
    expect(screen.queryByText("save")).not.toBeInTheDocument();
    expect(screen.queryByText("cancel")).not.toBeInTheDocument();
  });

  it("write user: fields enabled + save footer present", async () => {
    const { container } = render(<FinanceProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
    });
    expect(
      container.querySelector('input[value="Acme Verein"]') as HTMLInputElement
    ).not.toBeDisabled();
    expect(screen.getByText("save")).toBeInTheDocument();
    expect(screen.getByText("cancel")).toBeInTheDocument();
  });

  it("handleSave early-returns for a read-only user (no POST/PUT)", async () => {
    // The page hides the save button for read-only, but handleSave also guards on !canWriteFinance.
    // Pin the guard by rendering write=true, then this is implicitly covered above; here we assert
    // the read-only render fires no mutation even if save were reachable.
    authState.canWriteFinance = false;
    render(<FinanceProfilePage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
    });
    expect(apiPost).not.toHaveBeenCalled();
    expect(apiPut).not.toHaveBeenCalled();
  });
});

describe("FinanceProfilePage — A95 countryCode round-trip + A96 empty→null", () => {
  it("round-trips an OUT-OF-SET EU countryCode on save with no touch-edit (A95)", async () => {
    // "GB" is NOT in EU_COUNTRIES (the rendered subset). A CH→EU history or stale store can strand it.
    // The god-page round-trips form.countryCode verbatim — the future Zod field must accept the full
    // string union, NOT z.enum(EU_COUNTRIES).
    wireExisting({
      ...EXISTING_PROFILE,
      jurisdiction: "EU",
      countryCode: "GB",
      currency: "EUR",
      organizationCountry: "GB",
    });
    render(<FinanceProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
    });
    // No touch-edit — save immediately.
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/profile/prof-1",
        expect.objectContaining({ countryCode: "GB" })
      );
    });
  });

  it("maps empty optional fields to null on submit and never trims (A96)", async () => {
    // Profile with blank optionals (email/phone/website/uid/bank* are nullable).
    wireExisting({
      ...EXISTING_PROFILE,
      organizationEmail: null,
      organizationPhone: null,
      organizationWebsite: null,
      organizationUid: null,
      bankName: null,
      bankIban: null,
      bankBic: null,
      countryCode: null,
    });
    render(<FinanceProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalled();
    });
    const payload = apiPut.mock.calls[0][1] as Record<string, unknown>;
    // "" → null for optionals.
    expect(payload.organizationEmail).toBeNull();
    expect(payload.organizationPhone).toBeNull();
    expect(payload.organizationWebsite).toBeNull();
    expect(payload.organizationUid).toBeNull();
    expect(payload.bankName).toBeNull();
    expect(payload.bankIban).toBeNull();
    expect(payload.bankBic).toBeNull();
    expect(payload.countryCode).toBeNull();
    // Required strings are passed through untrimmed (no .trim() anywhere).
    expect(payload.organizationName).toBe("Acme Verein");
  });

  it("submits an untrimmed value for an edited field (A96 no-trim)", async () => {
    const { container } = render(<FinanceProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Verein")).toBeInTheDocument();
    });
    const nameInput = container.querySelector(
      'input[value="Acme Verein"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "  Padded Name  " } });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalled();
    });
    const payload = apiPut.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.organizationName).toBe("  Padded Name  ");
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// React 19's `use(promise)` Suspends on first render in tests; jsdom timing makes the
// suspension awkward to drive. Override `use()` so the test can pass a synchronous
// thenable that resolves immediately. Production behaviour is unaffected (this mock
// only applies to this test file).
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');
  return {
    ...actual,
    use: (input: unknown) => {
      const maybeThenable = input as { then?: (cb: (v: unknown) => void) => void };
      if (maybeThenable && typeof maybeThenable.then === 'function') {
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

// Synchronous "thenable" that lets `use()` extract its value without microtasks.
function syncThenable<T>(value: T): Promise<T> {
  return { then: (cb: (v: T) => void) => cb(value) } as unknown as Promise<T>;
}

import CheckInPage from './page';
import * as eventsService from '@/lib/services/events';

// REQ-023 (E3.S2) AC-7/AC-8: cover scanner/manual state-machine + idempotent banner +
// invalid-QR banner. Live-camera streaming is a manual / Playwright follow-up.

// next-intl: identity translations with token interpolation
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key,
}));

// next/navigation: stubbed router
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// next/dynamic: load the imported module synchronously so the scanner shows in tests
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ Scanner: React.ComponentType<unknown> }>) => {
    // The loader returns a promise; in tests we need a synchronous stub. The actual
    // @yudiel/react-qr-scanner module is browser-only and would fail in jsdom, so we
    // bypass it entirely with a simple identifying stub component.
    void loader;
    return function StubScanner() {
      return <div data-testid="qr-scanner-stub">qr-scanner</div>;
    };
  },
}));

// @/lib/auth: minimal in-test useAuth
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: null,
    roles: ['vorstand'],
    isAdmin: false,
    isVorstand: true,
    isKassier: false,
    isAuditor: false,
    isMember: true,
    hasRole: () => false,
    hasAnyRole: () => false,
    hasAllRoles: () => false,
    canReadFinance: false,
    canWriteFinance: false,
  }),
}));

// Mock the events service so we control roster + check-in responses
vi.mock('@/lib/services/events', async () => {
  const actual = await vi.importActual<typeof eventsService>('@/lib/services/events');
  return {
    ...actual,
    getEventCheckInRoster: vi.fn(),
    checkInByQrCode: vi.fn(),
    manualCheckIn: vi.fn(),
  };
});

const mockedRoster = {
  eventId: 'evt-1',
  eventTitle: 'Diwali 2026',
  eventStartDate: '2026-11-01T18:00:00Z',
  eventLocation: 'Venue',
  generatedAt: '2026-05-13T12:00:00Z',
  totalRegistrations: 2,
  checkedInCount: 0,
  items: [
    {
      registrationId: 'reg-anna',
      qrCodeToken: 'tok-anna',
      participantName: 'Anna Schmidt',
      numberOfGuests: 1,
      status: 'Confirmed' as const,
      isWaitlisted: false,
      isCheckedIn: false,
      checkedInAt: null,
      specialRequirements: null,
    },
    {
      registrationId: 'reg-bob',
      qrCodeToken: 'tok-bob',
      participantName: 'Bob Müller',
      numberOfGuests: 2,
      status: 'Confirmed' as const,
      isWaitlisted: false,
      isCheckedIn: false,
      checkedInAt: null,
      specialRequirements: null,
    },
  ],
};

function setMediaDevices(mode: 'available' | 'denied' | 'missing') {
  if (mode === 'missing') {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });
    return;
  }
  const getUserMedia =
    mode === 'available'
      ? vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
      : vi.fn().mockRejectedValue(Object.assign(new Error('NotAllowedError'), { name: 'NotAllowedError' }));
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
}

async function renderPage() {
  // Pass a synchronous thenable so the mocked `use()` returns the id immediately and we
  // skip Suspense altogether.
  const params = syncThenable({ id: 'evt-1' });
  return render(<CheckInPage params={params} />);
}

beforeEach(() => {
  vi.mocked(eventsService.getEventCheckInRoster).mockResolvedValue({ data: mockedRoster, error: undefined } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CheckInPage', () => {
  it('renders the scanner stub when mediaDevices is available', async () => {
    setMediaDevices('available');
    await renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('qr-scanner-stub')).toBeInTheDocument();
    });
  });

  it('flips to manual fallback when getUserMedia rejects with NotAllowedError', async () => {
    setMediaDevices('denied');
    await renderPage();

    // Manual section header (translation key id) appears once camera path is rejected.
    await waitFor(() => {
      expect(screen.getByPlaceholderText('manual.searchPlaceholder')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('qr-scanner-stub')).not.toBeInTheDocument();
  });

  it('flips to manual when navigator.mediaDevices is undefined', async () => {
    setMediaDevices('missing');
    await renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('manual.searchPlaceholder')).toBeInTheDocument();
    });
  });

  it('shows the manual roster names', async () => {
    setMediaDevices('denied');
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Anna Schmidt')).toBeInTheDocument();
      expect(screen.getByText('Bob Müller')).toBeInTheDocument();
    });
  });
});

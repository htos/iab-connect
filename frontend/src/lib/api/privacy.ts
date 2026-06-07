/**
 * REQ-029: Privacy & Consent API client
 */

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export interface ConsentDto {
  type: string;
  typeName: string;
  description: string;
  isRequired: boolean;
  isGranted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
}

interface ConsentOverviewDto {
  consents: ConsentDto[];
  currentPolicyVersion: string;
  hasRequiredConsents: boolean;
}

export async function getConsents(accessToken: string): Promise<ConsentDto[]> {
  const response = await fetch(`${baseUrl}/api/v1/privacy/consents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Failed to load consent preferences");
  const overview: ConsentOverviewDto = await response.json();
  return overview.consents;
}

export async function grantConsent(
  accessToken: string,
  type: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/privacy/consents/${type}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new Error("Failed to grant consent");
}

export async function revokeConsent(
  accessToken: string,
  type: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/privacy/consents/${type}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Failed to revoke consent");
}

// REQ-030 (E5-S5): channel preferences (self-scoped)
export interface ChannelAvailabilityDto {
  channel: string;
  isEnabled: boolean;
}

export interface ChannelPreferenceDto {
  preferredChannel: string;
  availableChannels: ChannelAvailabilityDto[];
}

export async function getChannelPreference(
  accessToken: string
): Promise<ChannelPreferenceDto> {
  const response = await fetch(
    `${baseUrl}/api/v1/privacy/channel-preferences`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!response.ok) throw new Error("Failed to load channel preference");
  return response.json();
}

export async function updateChannelPreference(
  accessToken: string,
  preferredChannel: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/v1/privacy/channel-preferences`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ preferredChannel }),
    }
  );
  if (!response.ok) throw new Error("Failed to update channel preference");
}

// Public API (no auth required)
export interface UnsubscribeVerifyResult {
  alreadyUnsubscribed: boolean;
  email: string;
  unsubscribedAt?: string;
}

export interface UnsubscribeConfirmResult {
  success: boolean;
  email: string;
  message: string;
}

export async function verifyUnsubscribe(
  token: string
): Promise<UnsubscribeVerifyResult> {
  const response = await fetch(
    `${baseUrl}/api/v1/public/newsletter/unsubscribe/${encodeURIComponent(token)}`
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Invalid token");
  }
  return response.json();
}

export async function confirmUnsubscribe(
  token: string
): Promise<UnsubscribeConfirmResult> {
  const response = await fetch(
    `${baseUrl}/api/v1/public/newsletter/unsubscribe/${encodeURIComponent(token)}`,
    { method: "POST" }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Unsubscribe failed");
  }
  return response.json();
}

export async function subscribeNewsletter(
  email: string,
  firstName?: string,
  lastName?: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${baseUrl}/api/v1/public/newsletter/subscribe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, firstName, lastName }),
    }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Subscribe failed");
  }
  return response.json();
}

export async function unsubscribeByEmail(
  email: string
): Promise<{ success: boolean; email: string; message: string }> {
  const response = await fetch(
    `${baseUrl}/api/v1/public/newsletter/unsubscribe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Unsubscribe failed");
  }
  return response.json();
}

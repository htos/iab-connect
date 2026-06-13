/**
 * Self-service consent + channel-preference transport (E31-S1; relocated verbatim
 * off the retired `privacy`). Authenticated, profile-owned surface —
 * the PUBLIC anonymous newsletter/unsubscribe fns moved to
 * `features/public/api/public-forms-api.ts`. REQ-029 / REQ-030 (E5-S5).
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

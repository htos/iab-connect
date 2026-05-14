using System.Text;

namespace IabConnect.Infrastructure.Events;

/// <summary>
/// REQ-025 (Epic-3-retro §9 / R3-H-S5-3): the server-side secret that keys the calendar-token
/// hash with HMAC. Bound from the <c>Auth</c> configuration section
/// (<c>Auth:CalendarTokenPepper</c>).
///
/// <para>When the pepper is left empty the calendar-token hash falls back to plain SHA-256 —
/// the backwards-compatible default for environments (local dev, CI) that have not provisioned
/// the secret. Production and staging set <c>Auth__CalendarTokenPepper</c> via the environment;
/// with the pepper configured, a database compromise alone can no longer confirm a member's
/// feed credential even against a known cleartext token.</para>
///
/// <para><b>Rollout:</b> configure the pepper <i>before</i> the
/// <c>HmacPepperCalendarSubscriptionTokens</c> migration runs in a given environment — the
/// migration re-hashes existing stored digests forward only when the pepper env var is present.
/// An environment that runs the migration without a pepper stays on plain SHA-256; to adopt the
/// pepper there afterwards, members must re-rotate their calendar tokens (the migration is
/// one-shot and cannot retroactively re-hash).</para>
/// </summary>
public sealed class CalendarTokenOptions
{
    public const string SectionName = "Auth";

    /// <summary>
    /// The configuration key (relative to <see cref="SectionName"/>) and the matching
    /// environment-variable name the migration reads. Kept here so the app and the migration
    /// agree on one spelling.
    /// </summary>
    public const string EnvironmentVariableName = "Auth__CalendarTokenPepper";

    public string? CalendarTokenPepper { get; set; }

    /// <summary>UTF-8 bytes of the configured pepper, or null when no pepper is configured.</summary>
    public byte[]? PepperBytes =>
        string.IsNullOrEmpty(CalendarTokenPepper) ? null : Encoding.UTF8.GetBytes(CalendarTokenPepper);
}

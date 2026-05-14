using System;
using IabConnect.Infrastructure.Events;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <summary>
    /// REQ-025 (Epic-3-retro §9 / R3-H-S5-3): re-hashes the stored calendar-subscription-token
    /// digests forward from plain SHA-256 to <c>HMAC-SHA256(pepper, SHA256(token))</c>.
    ///
    /// <para><b>No schema change</b> — only a data rewrite of the <c>calendar_subscription_token</c>
    /// column. The HMAC is keyed over the already-stored SHA-256 <i>digest bytes</i>, not the
    /// cleartext token, so the rewrite never needs the cleartext (which is not persisted).</para>
    ///
    /// <para><b>Pepper-gated, environment-safe.</b> The migration reads the pepper from the
    /// <c>Auth__CalendarTokenPepper</c> environment variable — the same value the application
    /// binds as <c>Auth:CalendarTokenPepper</c> (<see cref="CalendarTokenOptions"/>). When the
    /// variable is absent or empty the migration is a <b>no-op</b>: that environment (local dev,
    /// CI) keeps plain SHA-256 hashes, and the application's hasher mirrors this by falling back
    /// to plain SHA-256 when no pepper is configured. Nothing breaks for un-peppered
    /// environments. Production/staging set the env var <i>before</i> this migration runs and
    /// get the HMAC hardening end-to-end.</para>
    ///
    /// <para><b>Adopting the pepper later:</b> this migration is one-shot (EF records it in
    /// <c>__EFMigrationsHistory</c> and never re-runs). An environment that ran it without a
    /// pepper and later wants the hardening must have its members re-rotate their calendar
    /// tokens — the cleartext is gone, so the existing plain-SHA-256 rows cannot be
    /// retroactively HMAC-keyed.</para>
    /// </summary>
    public partial class HmacPepperCalendarSubscriptionTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var pepper = Environment.GetEnvironmentVariable(CalendarTokenOptions.EnvironmentVariableName);
            if (string.IsNullOrEmpty(pepper))
            {
                // No pepper configured in this environment — leave calendar-token hashes as
                // plain SHA-256. The application's hasher falls back to the same scheme, so the
                // column and the code stay consistent.
                return;
            }

            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

            // The column currently holds encode(SHA256(token), 'hex'). Re-key each digest with
            // HMAC-SHA256 over the *digest bytes* using the UTF-8 bytes of the pepper — exactly
            // what Member.HashCalendarToken(token, pepper) computes at request/rotate time.
            // The single-quote escaping keeps an operator-supplied pepper from breaking the SQL.
            var sqlSafePepper = pepper.Replace("'", "''");
            migrationBuilder.Sql(
                $@"UPDATE members
                   SET calendar_subscription_token =
                       encode(
                         hmac(
                           decode(calendar_subscription_token, 'hex'),
                           convert_to('{sqlSafePepper}', 'UTF8'),
                           'sha256'),
                         'hex')
                   WHERE calendar_subscription_token IS NOT NULL
                     AND length(calendar_subscription_token) = 64;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // One-way. HMAC is not reversible: the cleartext tokens were never stored and the
            // pre-HMAC SHA-256 digests cannot be recovered from the HMAC outputs. For an
            // un-peppered environment Up() was a no-op, so Down() is correctly empty there too.
            //
            // Operator rollback playbook (peppered environments only):
            //   1. Do NOT `dotnet ef migrations remove` against a database this migration
            //      rewrote — the schema is unchanged but the data is now HMAC-keyed.
            //   2. To roll back, restore from the point-in-time backup taken immediately before
            //      this migration ran (always take one before a data-rewriting migration).
            //   3. If no backup exists, NULL the column and have every member re-rotate their
            //      calendar token (their existing subscription URLs break).
            //
            // Same posture as 20260513205649_HashCalendarSubscriptionTokens (R3-DN-1 option c).
        }
    }
}

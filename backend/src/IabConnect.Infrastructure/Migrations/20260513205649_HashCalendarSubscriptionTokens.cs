using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <summary>
    /// REQ-025 (E3.S5 post-review H-S5-1): in-place hash backfill of the
    /// <c>calendar_subscription_token</c> column. The column now stores a SHA-256 hex digest
    /// instead of the cleartext token; the column name is kept for stability.
    ///
    /// <para>Why this matters: previously a DB-read attacker could replay any active calendar
    /// feed because the cleartext token was stored verbatim. After backfill, only the digest
    /// lives in the database — request-time lookup hashes the incoming token and compares.
    /// SHA-256 preimage resistance is the security boundary.</para>
    ///
    /// <para>Backfill uses pgcrypto's <c>digest()</c>. The extension is created idempotently
    /// inside the migration so the migration is self-contained. The <c>length &lt;&gt; 64</c>
    /// guard makes the migration idempotent — re-running it does not double-hash already
    /// hashed rows. Cleartext tokens already distributed in subscription URLs continue to
    /// work because the server hashes them on arrival before comparing — clients see no
    /// breakage.</para>
    /// </summary>
    public partial class HashCalendarSubscriptionTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
            migrationBuilder.Sql(
                @"UPDATE members
                  SET calendar_subscription_token = encode(digest(calendar_subscription_token, 'sha256'), 'hex')
                  WHERE calendar_subscription_token IS NOT NULL
                    AND length(calendar_subscription_token) <> 64;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // REQ-025 (E3.S5 Round-3 R3-DN-1 / R3-C4): Decision-DN-1 picked option (c) — accept
            // the in-place rename for THIS migration and document rollback as backup-only.
            // Hashes are one-way: reversing would leave the column in a half-state (some
            // cleartext, some hashed) that the application could not authenticate against
            // consistently. The application code (MemberRepository.GetByCalendarTokenAsync)
            // hashes the incoming token at request time, so a rolled-back code path against
            // the still-hashed column data would silently 404 every feed fetch.
            //
            // **Operator rollback playbook:**
            // 1. Do NOT run `dotnet ef migrations remove` against a database that has been
            //    upgraded with this migration. The schema is identical (column rename only)
            //    but the data is now SHA-256-hex; tokens cannot be recovered.
            // 2. If a rollback is required, restore from the PIT backup taken immediately
            //    before this migration ran (operator should ALWAYS take such a backup before
            //    deploying schema-or-data-rewriting migrations).
            // 3. If no backup is available, the only path forward is to NULL the column and
            //    ask every member to rotate their calendar token, breaking their existing
            //    subscription URLs.
            //
            // This deliberate "no-op Down" is the same posture as data-rewriting migrations
            // for hashed passwords and signed tokens elsewhere in the .NET ecosystem.
        }
    }
}

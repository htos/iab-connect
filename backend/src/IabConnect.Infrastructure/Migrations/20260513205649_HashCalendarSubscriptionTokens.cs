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
            // Intentionally empty — hashes are one-way. Reversing this migration would leave
            // the column in a half-state (some cleartext, some hashed) that the application
            // could not consistently authenticate against. Operators who need to roll back
            // should null the column and ask members to re-rotate.
        }
    }
}

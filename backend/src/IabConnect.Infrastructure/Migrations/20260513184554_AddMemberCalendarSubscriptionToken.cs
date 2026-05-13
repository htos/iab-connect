using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <summary>
    /// REQ-025 (E3.S5): Adds <c>calendar_subscription_token VARCHAR(64) NULL</c> to
    /// <c>members</c> plus a partial unique index where the token is non-null. The token is
    /// Base64URL of 32 random bytes (~43 chars); the 64-char cap leaves headroom. Null tokens
    /// represent "feed revoked / never generated" and may coexist on many rows, hence the
    /// partial filter. No FK; A9 not triggered.
    /// </summary>
    public partial class AddMemberCalendarSubscriptionToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "calendar_subscription_token",
                table: "members",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_members_calendar_subscription_token",
                table: "members",
                column: "calendar_subscription_token",
                unique: true,
                filter: "calendar_subscription_token IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_members_calendar_subscription_token",
                table: "members");

            migrationBuilder.DropColumn(
                name: "calendar_subscription_token",
                table: "members");
        }
    }
}

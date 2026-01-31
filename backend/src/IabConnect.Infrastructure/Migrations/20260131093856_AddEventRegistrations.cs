using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEventRegistrations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_registrations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    member_id = table.Column<Guid>(type: "uuid", nullable: true),
                    participant_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    participant_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    participant_phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    number_of_guests = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    is_waitlisted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    waitlist_position = table.Column<int>(type: "integer", nullable: true),
                    registered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    confirmed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancellation_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    cancelled_by_participant = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    checked_in_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    checked_in_by = table.Column<Guid>(type: "uuid", nullable: true),
                    is_no_show = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    special_requirements = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    qr_code_token = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_registrations", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_registrations_event_email",
                table: "event_registrations",
                columns: new[] { "event_id", "participant_email" });

            migrationBuilder.CreateIndex(
                name: "ix_event_registrations_event_id",
                table: "event_registrations",
                column: "event_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_registrations_event_user",
                table: "event_registrations",
                columns: new[] { "event_id", "user_id" });

            migrationBuilder.CreateIndex(
                name: "ix_event_registrations_member_id",
                table: "event_registrations",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_registrations_participant_email",
                table: "event_registrations",
                column: "participant_email");

            migrationBuilder.CreateIndex(
                name: "ix_event_registrations_qr_code_token",
                table: "event_registrations",
                column: "qr_code_token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_event_registrations_status",
                table: "event_registrations",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_event_registrations_user_id",
                table: "event_registrations",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_registrations_waitlist",
                table: "event_registrations",
                columns: new[] { "event_id", "is_waitlisted", "waitlist_position" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_registrations");
        }
    }
}

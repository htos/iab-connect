using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <summary>
    /// REQ-024 (E3.S4): Adds <c>reminder_sent_at TIMESTAMPTZ NULL</c> to
    /// <c>event_volunteer_assignments</c>. Set once by the daily Hangfire job
    /// <c>VolunteerShiftReminderJob</c> via a mark-only <c>ExecuteUpdate</c> (no aggregate
    /// load) so it doesn't clash with concurrent member withdraws / manager cancels.
    /// No FK; no <c>OnDelete</c> decision required (A9 not triggered).
    /// </summary>
    public partial class AddReminderSentAtToEventVolunteerAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "reminder_sent_at",
                table: "event_volunteer_assignments",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "reminder_sent_at",
                table: "event_volunteer_assignments");
        }
    }
}

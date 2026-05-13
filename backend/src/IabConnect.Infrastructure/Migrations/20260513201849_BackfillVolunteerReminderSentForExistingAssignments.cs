using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <summary>
    /// REQ-024 (E3.S4 review M-S4-4): Backfills <c>reminder_sent_at</c> to the migration
    /// apply-time for every existing assignment whose value is still NULL. Without this,
    /// the first <c>VolunteerShiftReminderJob</c> execution after the E3.S4 column-add
    /// migration would treat ALL pre-existing in-window assignments as due and send a
    /// retroactive bulk wave of reminder emails. Backfilling marks them "already-reminded"
    /// so only assignments created AFTER this migration flow through the normal path.
    /// </summary>
    public partial class BackfillVolunteerReminderSentForExistingAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                @"UPDATE event_volunteer_assignments
                  SET reminder_sent_at = CURRENT_TIMESTAMP
                  WHERE reminder_sent_at IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally empty — undoing the backfill would re-arm the retroactive emails
            // for assignments that were intentionally suppressed.
        }
    }
}

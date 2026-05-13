using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <summary>
    /// REQ-024 (E3.S3, post-Epic-3-review patch H-S3-6): Adds shift-level lifecycle state to
    /// <c>event_volunteer_shifts</c>. Three new columns:
    /// <list type="bullet">
    ///   <item><c>status VARCHAR(50) NOT NULL DEFAULT 'Active'</c> — enum
    ///   <c>VolunteerShiftStatus</c> persisted as a string (mirrors the assignment table's
    ///   <c>status</c> column for symmetry and so enum-value renames remain stable at the
    ///   storage layer).</item>
    ///   <item><c>cancelled_at TIMESTAMP WITH TIME ZONE NULL</c> — UTC timestamp set when
    ///   <c>EventVolunteerShift.Cancel(...)</c> fires.</item>
    ///   <item><c>cancellation_reason VARCHAR(500) NULL</c> — operator-supplied reason.</item>
    /// </list>
    ///
    /// <para><b>A9 (FK delete-behavior rationale):</b> No new foreign keys are added in this
    /// migration; the parent <c>AddEventVolunteerPlanning</c> migration's A9 block continues
    /// to govern all six existing FKs (cascade for parent-owned lifecycle, restrict for
    /// audit/history preservation).</para>
    ///
    /// <para><b>Backfill:</b> existing rows are stamped with <c>status = 'Active'</c> via the
    /// column default. No retroactive cancellations are inferred from the absence of a
    /// <c>cancelled_at</c> value on prior data (Epic 3 is pre-release; no production rows yet).</para>
    /// </summary>
    public partial class AddVolunteerShiftCancellationState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cancellation_reason",
                table: "event_volunteer_shifts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "cancelled_at",
                table: "event_volunteer_shifts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "event_volunteer_shifts",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Active");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cancellation_reason",
                table: "event_volunteer_shifts");

            migrationBuilder.DropColumn(
                name: "cancelled_at",
                table: "event_volunteer_shifts");

            migrationBuilder.DropColumn(
                name: "status",
                table: "event_volunteer_shifts");
        }
    }
}

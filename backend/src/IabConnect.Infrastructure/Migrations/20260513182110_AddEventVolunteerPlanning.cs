using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <summary>
    /// REQ-024 (E3.S3): Volunteer-planning data model — three tables (roles, shifts,
    /// assignments) with six foreign keys + one partial unique index + one CHECK constraint.
    ///
    /// <para><b>A9 rationale — every new FK carries its OnDelete reason</b>
    /// (Epic-2 retro A9; first migration to demonstrate the discipline).</para>
    ///
    /// <list type="bullet">
    ///   <item><c>event_volunteer_roles.event_id → events.id</c> = <b>CASCADE</b>. A volunteer
    ///   role has no meaning without its parent event.</item>
    ///   <item><c>event_volunteer_shifts.event_id → events.id</c> = <b>CASCADE</b>. Same.</item>
    ///   <item><c>event_volunteer_shifts.role_id → event_volunteer_roles.id</c> = <b>RESTRICT</b>.
    ///   A role with active shifts must be deactivated, not deleted.</item>
    ///   <item><c>event_volunteer_assignments.shift_id → event_volunteer_shifts.id</c> = <b>CASCADE</b>.
    ///   An assignment is meaningless without its shift.</item>
    ///   <item><c>event_volunteer_assignments.role_id → event_volunteer_roles.id</c> = <b>RESTRICT</b>.
    ///   Roles with assignment history must not vanish.</item>
    ///   <item><c>event_volunteer_assignments.member_id → members.id</c> = <b>RESTRICT</b>.
    ///   Volunteer history is forensic; matches the merge-source FK precedent (Epic-2 retro).</item>
    /// </list>
    ///
    /// <para>Partial unique index <c>ix_event_volunteer_assignments_shift_member_active</c>
    /// on <c>(shift_id, member_id) WHERE status &lt;&gt; 'Cancelled'</c> guards against
    /// double-signup (story D3). CHECK constraint <c>ck_event_volunteer_shifts_capacity_min</c>
    /// enforces <c>capacity &gt;= 1</c> at the storage layer. The role unique index is rewritten
    /// in raw SQL to use <c>lower(name)</c> for case-insensitive uniqueness per event.</para>
    /// </summary>
    public partial class AddEventVolunteerPlanning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_volunteer_roles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_volunteer_roles", x => x.id);
                    table.ForeignKey(
                        name: "FK_event_volunteer_roles_events_event_id",
                        column: x => x.event_id,
                        principalTable: "events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_volunteer_shifts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    starts_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ends_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    capacity = table.Column<int>(type: "integer", nullable: false),
                    allow_waitlist = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    allow_self_signup = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_volunteer_shifts", x => x.id);
                    table.CheckConstraint("ck_event_volunteer_shifts_capacity_min", "capacity >= 1");
                    table.ForeignKey(
                        name: "FK_event_volunteer_shifts_event_volunteer_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "event_volunteer_roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_event_volunteer_shifts_events_event_id",
                        column: x => x.event_id,
                        principalTable: "events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_volunteer_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    shift_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    position = table.Column<int>(type: "integer", nullable: true),
                    assigned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    assigned_by = table.Column<Guid>(type: "uuid", nullable: false),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancellation_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_volunteer_assignments", x => x.id);
                    table.ForeignKey(
                        name: "FK_event_volunteer_assignments_event_volunteer_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "event_volunteer_roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_event_volunteer_assignments_event_volunteer_shifts_shift_id",
                        column: x => x.shift_id,
                        principalTable: "event_volunteer_shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_event_volunteer_assignments_members_member_id",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_volunteer_assignments_member_id",
                table: "event_volunteer_assignments",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "IX_event_volunteer_assignments_role_id",
                table: "event_volunteer_assignments",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_volunteer_assignments_shift_id",
                table: "event_volunteer_assignments",
                column: "shift_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_volunteer_assignments_shift_member_active",
                table: "event_volunteer_assignments",
                columns: new[] { "shift_id", "member_id" },
                unique: true,
                filter: "status <> 'Cancelled'");

            migrationBuilder.CreateIndex(
                name: "ix_event_volunteer_assignments_shift_status",
                table: "event_volunteer_assignments",
                columns: new[] { "shift_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_event_volunteer_roles_event_id",
                table: "event_volunteer_roles",
                column: "event_id");

            // Case-insensitive unique role name per event. EF emits a plain multi-column
            // unique index; rewrite to use lower(name) so "Greeter" and "greeter" collide.
            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX ix_event_volunteer_roles_event_name_lower " +
                "ON event_volunteer_roles (event_id, lower(name));");

            migrationBuilder.CreateIndex(
                name: "ix_event_volunteer_shifts_event_id",
                table: "event_volunteer_shifts",
                column: "event_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_volunteer_shifts_role_starts_at",
                table: "event_volunteer_shifts",
                columns: new[] { "role_id", "starts_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_volunteer_assignments");

            migrationBuilder.DropTable(
                name: "event_volunteer_shifts");

            migrationBuilder.DropTable(
                name: "event_volunteer_roles");
        }
    }
}

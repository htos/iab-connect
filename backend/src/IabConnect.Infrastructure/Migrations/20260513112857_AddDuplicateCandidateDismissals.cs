using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDuplicateCandidateDismissals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "duplicate_candidate_dismissals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    dismissed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    dismissed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_duplicate_candidate_dismissals", x => x.id);
                    table.ForeignKey(
                        name: "FK_duplicate_candidate_dismissals_members_source_member_id",
                        column: x => x.source_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_duplicate_candidate_dismissals_members_target_member_id",
                        column: x => x.target_member_id,
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_duplicate_candidate_dismissals_pair",
                table: "duplicate_candidate_dismissals",
                columns: new[] { "source_member_id", "target_member_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_duplicate_candidate_dismissals_target_member_id",
                table: "duplicate_candidate_dismissals",
                column: "target_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "duplicate_candidate_dismissals");
        }
    }
}

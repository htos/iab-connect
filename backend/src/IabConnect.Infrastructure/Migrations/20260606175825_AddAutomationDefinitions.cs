using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAutomationDefinitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "automation_definitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    template_id = table.Column<int>(type: "integer", nullable: false),
                    trigger_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    trigger_offset_days = table.Column<int>(type: "integer", nullable: true),
                    segment_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    segment_filter = table.Column<string>(type: "text", nullable: true),
                    consent_filter = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_automation_definitions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_automation_definitions_created_at",
                table: "automation_definitions",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_automation_definitions_created_by_id",
                table: "automation_definitions",
                column: "created_by_id");

            migrationBuilder.CreateIndex(
                name: "IX_automation_definitions_status",
                table: "automation_definitions",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "automation_definitions");
        }
    }
}

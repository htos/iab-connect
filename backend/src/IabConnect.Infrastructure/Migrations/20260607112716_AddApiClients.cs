using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddApiClients : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "api_clients",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    secret_prefix = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    secret_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    scopes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    is_revoked = table.Column<bool>(type: "boolean", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_clients", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_api_clients_created_at",
                table: "api_clients",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_api_clients_secret_prefix",
                table: "api_clients",
                column: "secret_prefix",
                unique: true);

            // REQ-058 (E8-S1): seed the new "api" module row (ModuleKeys.Api). enabled = true so the
            // external integration surface is behaviour-preserving on upgrade — the route group is
            // available from day one until an admin disables it. Fixed Guid + fixed UTC timestamp
            // keep the migration deterministic, mirroring AddModuleSettings.
            migrationBuilder.InsertData(
                table: "module_settings",
                columns: new[] { "id", "module_key", "enabled", "updated_at", "updated_by" },
                values: new object[] { new Guid("a1000000-0000-0000-0000-000000000008"), "api", true, new DateTime(2026, 6, 7, 0, 0, 0, DateTimeKind.Utc), null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "module_settings",
                keyColumn: "id",
                keyValue: new Guid("a1000000-0000-0000-0000-000000000008"));

            migrationBuilder.DropTable(
                name: "api_clients");
        }
    }
}

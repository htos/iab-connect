using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <summary>
    /// REQ-087 (E10-S1): Adds the <c>module_settings</c> table — the per-module enablement
    /// state that drives navigation, routing and backend enforcement (E10-S3/S4). Columns:
    /// <list type="bullet">
    ///   <item><c>id UUID</c> — primary key.</item>
    ///   <item><c>module_key VARCHAR(50) NOT NULL</c> — canonical module key; UNIQUE.</item>
    ///   <item><c>enabled BOOLEAN NOT NULL</c> — whether the module is available.</item>
    ///   <item><c>updated_at TIMESTAMPTZ NOT NULL</c> — last enablement change.</item>
    ///   <item><c>updated_by VARCHAR(200) NULL</c> — actor of the last change; NULL for seed.</item>
    /// </list>
    ///
    /// <para><b>Single-tenant (ADR-007):</b> no <c>organization_id</c> column — the seven
    /// rows are global, exactly like the singleton <c>system_settings</c> row. This resolves
    /// open decision OD-2.</para>
    ///
    /// <para><b>Behaviour-preserving seed:</b> the migration seeds the seven module rows
    /// (<c>members, events, documents, communication, finance, partners, public_view</c>),
    /// all <c>enabled = true</c>. An existing deployment behaves identically after
    /// <c>dotnet ef database update</c> — every module stays on until an admin disables it.
    /// Fixed <c>Guid</c> literals and a fixed UTC <c>updated_at</c> keep the migration
    /// deterministic.</para>
    ///
    /// <para><b>FK rationale:</b> no foreign keys are added or changed by this migration.</para>
    /// </summary>
    public partial class AddModuleSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "module_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    module_key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_module_settings", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_module_settings_module_key",
                table: "module_settings",
                column: "module_key",
                unique: true);

            // Behaviour-preserving seed: 7 modules, all enabled. Fixed Guids + fixed UTC
            // timestamp keep this deterministic across environments.
            var seededAt = new DateTime(2026, 5, 14, 0, 0, 0, DateTimeKind.Utc);

            migrationBuilder.InsertData(
                table: "module_settings",
                columns: new[] { "id", "module_key", "enabled", "updated_at", "updated_by" },
                values: new object[,]
                {
                    { new Guid("a1000000-0000-0000-0000-000000000001"), "members", true, seededAt, null },
                    { new Guid("a1000000-0000-0000-0000-000000000002"), "events", true, seededAt, null },
                    { new Guid("a1000000-0000-0000-0000-000000000003"), "documents", true, seededAt, null },
                    { new Guid("a1000000-0000-0000-0000-000000000004"), "communication", true, seededAt, null },
                    { new Guid("a1000000-0000-0000-0000-000000000005"), "finance", true, seededAt, null },
                    { new Guid("a1000000-0000-0000-0000-000000000006"), "partners", true, seededAt, null },
                    { new Guid("a1000000-0000-0000-0000-000000000007"), "public_view", true, seededAt, null },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Dropping the table also removes the seeded rows.
            migrationBuilder.DropTable(
                name: "module_settings");
        }
    }
}

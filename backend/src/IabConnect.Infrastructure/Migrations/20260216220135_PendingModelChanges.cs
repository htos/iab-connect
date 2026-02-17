using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PendingModelChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "activity_area_id",
                table: "transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "activity_area_id",
                table: "invoice_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "activity_areas",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_activity_areas", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_transactions_activity_area_id",
                table: "transactions",
                column: "activity_area_id");

            migrationBuilder.CreateIndex(
                name: "IX_invoice_items_activity_area_id",
                table: "invoice_items",
                column: "activity_area_id");

            migrationBuilder.CreateIndex(
                name: "ix_activity_areas_code_unique_active",
                table: "activity_areas",
                column: "code",
                unique: true,
                filter: "is_deleted = false");

            migrationBuilder.AddForeignKey(
                name: "FK_invoice_items_activity_areas_activity_area_id",
                table: "invoice_items",
                column: "activity_area_id",
                principalTable: "activity_areas",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_transactions_activity_areas_activity_area_id",
                table: "transactions",
                column: "activity_area_id",
                principalTable: "activity_areas",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_invoice_items_activity_areas_activity_area_id",
                table: "invoice_items");

            migrationBuilder.DropForeignKey(
                name: "FK_transactions_activity_areas_activity_area_id",
                table: "transactions");

            migrationBuilder.DropTable(
                name: "activity_areas");

            migrationBuilder.DropIndex(
                name: "IX_transactions_activity_area_id",
                table: "transactions");

            migrationBuilder.DropIndex(
                name: "IX_invoice_items_activity_area_id",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "activity_area_id",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "activity_area_id",
                table: "invoice_items");
        }
    }
}

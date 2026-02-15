using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVatSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "net_amount",
                table: "transactions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "tax_amount",
                table: "transactions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tax_code_id",
                table: "transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "tax_rate",
                table: "transactions",
                type: "numeric(18,6)",
                precision: 18,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "subtotal_net",
                table: "invoices",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "total_gross",
                table: "invoices",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "total_tax",
                table: "invoices",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "gross_amount",
                table: "invoice_items",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_gross_entry",
                table: "invoice_items",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "net_amount",
                table: "invoice_items",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "tax_amount",
                table: "invoice_items",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tax_code_id",
                table: "invoice_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "tax_rate",
                table: "invoice_items",
                type: "numeric(18,6)",
                precision: 18,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "vat_number",
                table: "finance_profiles",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "vat_status",
                table: "finance_profiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "NotRegistered");

            migrationBuilder.CreateTable(
                name: "tax_codes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    rate = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tax_codes", x => x.id);
                });

            migrationBuilder.InsertData(
                table: "tax_codes",
                columns: new[] { "id", "code", "created_at", "deleted_at", "is_active", "is_default", "label", "rate", "updated_at" },
                values: new object[] { new Guid("a0000000-0000-0000-0000-000000000001"), "MWST_NORMAL", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, true, "8.1% MWST (Normal)", 0.081m, null });

            migrationBuilder.InsertData(
                table: "tax_codes",
                columns: new[] { "id", "code", "created_at", "deleted_at", "is_active", "label", "rate", "updated_at" },
                values: new object[,]
                {
                    { new Guid("a0000000-0000-0000-0000-000000000002"), "MWST_REDUCED", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "2.6% MWST (Reduziert)", 0.026m, null },
                    { new Guid("a0000000-0000-0000-0000-000000000003"), "MWST_ACCOMMODATION", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "3.8% MWST (Beherbergung)", 0.038m, null },
                    { new Guid("a0000000-0000-0000-0000-000000000004"), "MWST_EXEMPT", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, true, "0% MWST (Befreit)", 0m, null }
                });

            migrationBuilder.CreateIndex(
                name: "ix_tax_codes_code_unique_active",
                table: "tax_codes",
                column: "code",
                unique: true,
                filter: "is_deleted = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tax_codes");

            migrationBuilder.DropColumn(
                name: "net_amount",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "tax_amount",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "tax_code_id",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "tax_rate",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "subtotal_net",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "total_gross",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "total_tax",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "gross_amount",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "is_gross_entry",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "net_amount",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "tax_amount",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "tax_code_id",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "tax_rate",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "vat_number",
                table: "finance_profiles");

            migrationBuilder.DropColumn(
                name: "vat_status",
                table: "finance_profiles");
        }
    }
}

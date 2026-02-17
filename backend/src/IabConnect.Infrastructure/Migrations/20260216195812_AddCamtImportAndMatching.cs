using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCamtImportAndMatching : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "format",
                table: "bank_imports",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Csv");

            migrationBuilder.AddColumn<string>(
                name: "original_file_storage_path",
                table: "bank_imports",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "creditor_reference",
                table: "bank_import_items",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "debtor_iban",
                table: "bank_import_items",
                type: "character varying(34)",
                maxLength: 34,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "debtor_name",
                table: "bank_import_items",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "end_to_end_id",
                table: "bank_import_items",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "match_confidence",
                table: "bank_import_items",
                type: "numeric(5,4)",
                precision: 5,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "remittance_info",
                table: "bank_import_items",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "suggested_invoice_id",
                table: "bank_import_items",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "format",
                table: "bank_imports");

            migrationBuilder.DropColumn(
                name: "original_file_storage_path",
                table: "bank_imports");

            migrationBuilder.DropColumn(
                name: "creditor_reference",
                table: "bank_import_items");

            migrationBuilder.DropColumn(
                name: "debtor_iban",
                table: "bank_import_items");

            migrationBuilder.DropColumn(
                name: "debtor_name",
                table: "bank_import_items");

            migrationBuilder.DropColumn(
                name: "end_to_end_id",
                table: "bank_import_items");

            migrationBuilder.DropColumn(
                name: "match_confidence",
                table: "bank_import_items");

            migrationBuilder.DropColumn(
                name: "remittance_info",
                table: "bank_import_items");

            migrationBuilder.DropColumn(
                name: "suggested_invoice_id",
                table: "bank_import_items");
        }
    }
}

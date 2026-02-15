using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "transactions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "deleted_by",
                table: "transactions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "transactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "receipts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "deleted_by",
                table: "receipts",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "receipts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "deleted_by",
                table: "payments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "payments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "cancellation_reason",
                table: "invoices",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "cancelled_at",
                table: "invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "deleted_by",
                table: "invoices",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "dunning_notices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "deleted_by",
                table: "dunning_notices",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "dunning_notices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "categories",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "deleted_by",
                table: "categories",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "categories",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "bank_imports",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "deleted_by",
                table: "bank_imports",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "bank_imports",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "accounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "deleted_by",
                table: "accounts",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "accounts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "ix_transactions_is_deleted",
                table: "transactions",
                column: "is_deleted");

            migrationBuilder.CreateIndex(
                name: "ix_receipts_is_deleted",
                table: "receipts",
                column: "is_deleted");

            migrationBuilder.CreateIndex(
                name: "ix_payments_is_deleted",
                table: "payments",
                column: "is_deleted");

            migrationBuilder.CreateIndex(
                name: "ix_invoices_is_deleted",
                table: "invoices",
                column: "is_deleted");

            migrationBuilder.CreateIndex(
                name: "ix_dunning_notices_is_deleted",
                table: "dunning_notices",
                column: "is_deleted");

            migrationBuilder.CreateIndex(
                name: "ix_categories_is_deleted",
                table: "categories",
                column: "is_deleted");

            migrationBuilder.CreateIndex(
                name: "ix_bank_imports_is_deleted",
                table: "bank_imports",
                column: "is_deleted");

            migrationBuilder.CreateIndex(
                name: "ix_accounts_is_deleted",
                table: "accounts",
                column: "is_deleted");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_transactions_is_deleted",
                table: "transactions");

            migrationBuilder.DropIndex(
                name: "ix_receipts_is_deleted",
                table: "receipts");

            migrationBuilder.DropIndex(
                name: "ix_payments_is_deleted",
                table: "payments");

            migrationBuilder.DropIndex(
                name: "ix_invoices_is_deleted",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "ix_dunning_notices_is_deleted",
                table: "dunning_notices");

            migrationBuilder.DropIndex(
                name: "ix_categories_is_deleted",
                table: "categories");

            migrationBuilder.DropIndex(
                name: "ix_bank_imports_is_deleted",
                table: "bank_imports");

            migrationBuilder.DropIndex(
                name: "ix_accounts_is_deleted",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "receipts");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "receipts");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "receipts");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "cancellation_reason",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "cancelled_at",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "dunning_notices");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "dunning_notices");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "dunning_notices");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "bank_imports");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "bank_imports");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "bank_imports");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "accounts");
        }
    }
}

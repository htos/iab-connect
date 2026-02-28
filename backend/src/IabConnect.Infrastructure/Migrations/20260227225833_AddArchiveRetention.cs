using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddArchiveRetention : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "archive_reason",
                table: "transactions",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "archived_at",
                table: "transactions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "transactions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_archived",
                table: "transactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "retain_until",
                table: "transactions",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "archive_reason",
                table: "receipts",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "archived_at",
                table: "receipts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "receipts",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_archived",
                table: "receipts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "retain_until",
                table: "receipts",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "archive_reason",
                table: "invoices",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "archived_at",
                table: "invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archived_by",
                table: "invoices",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_archived",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "retain_until",
                table: "invoices",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.CreateIndex(
                name: "ix_transactions_is_archived",
                table: "transactions",
                column: "is_archived");

            migrationBuilder.CreateIndex(
                name: "ix_receipts_is_archived",
                table: "receipts",
                column: "is_archived");

            migrationBuilder.CreateIndex(
                name: "ix_invoices_is_archived",
                table: "invoices",
                column: "is_archived");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_transactions_is_archived",
                table: "transactions");

            migrationBuilder.DropIndex(
                name: "ix_receipts_is_archived",
                table: "receipts");

            migrationBuilder.DropIndex(
                name: "ix_invoices_is_archived",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "archive_reason",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "is_archived",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "retain_until",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "archive_reason",
                table: "receipts");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "receipts");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "receipts");

            migrationBuilder.DropColumn(
                name: "is_archived",
                table: "receipts");

            migrationBuilder.DropColumn(
                name: "retain_until",
                table: "receipts");

            migrationBuilder.DropColumn(
                name: "archive_reason",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "archived_by",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "is_archived",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "retain_until",
                table: "invoices");
        }
    }
}

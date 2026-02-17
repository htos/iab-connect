using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentReceiptId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "receipt_id",
                table: "payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_payments_receipt_id",
                table: "payments",
                column: "receipt_id");

            migrationBuilder.AddForeignKey(
                name: "FK_payments_receipts_receipt_id",
                table: "payments",
                column: "receipt_id",
                principalTable: "receipts",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_payments_receipts_receipt_id",
                table: "payments");

            migrationBuilder.DropIndex(
                name: "IX_payments_receipt_id",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "receipt_id",
                table: "payments");
        }
    }
}

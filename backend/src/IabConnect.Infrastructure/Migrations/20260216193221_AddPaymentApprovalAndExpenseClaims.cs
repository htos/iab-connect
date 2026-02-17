using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentApprovalAndExpenseClaims : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "approval_comment",
                table: "payments",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "approved_at",
                table: "payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "approved_by",
                table: "payments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "rejected_at",
                table: "payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rejected_by",
                table: "payments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rejection_reason",
                table: "payments",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "payments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "approval_threshold_chf",
                table: "finance_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "approval_threshold_eur",
                table: "finance_profiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "expense_claims",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    claimant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    claimant_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    receipt_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    review_comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    approved_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    approved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    approval_comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    rejected_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    rejected_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    rejection_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    payment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reimbursed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reimbursed_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expense_claims", x => x.id);
                    table.ForeignKey(
                        name: "FK_expense_claims_payments_payment_id",
                        column: x => x.payment_id,
                        principalTable: "payments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_expense_claims_receipts_receipt_id",
                        column: x => x.receipt_id,
                        principalTable: "receipts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_expense_claims_claimant_id",
                table: "expense_claims",
                column: "claimant_id");

            migrationBuilder.CreateIndex(
                name: "ix_expense_claims_is_deleted",
                table: "expense_claims",
                column: "is_deleted");

            migrationBuilder.CreateIndex(
                name: "IX_expense_claims_payment_id",
                table: "expense_claims",
                column: "payment_id");

            migrationBuilder.CreateIndex(
                name: "IX_expense_claims_receipt_id",
                table: "expense_claims",
                column: "receipt_id");

            migrationBuilder.CreateIndex(
                name: "ix_expense_claims_status",
                table: "expense_claims",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "expense_claims");

            migrationBuilder.DropColumn(
                name: "approval_comment",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "approved_at",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "approved_by",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "rejected_at",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "rejected_by",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "rejection_reason",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "status",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "approval_threshold_chf",
                table: "finance_profiles");

            migrationBuilder.DropColumn(
                name: "approval_threshold_eur",
                table: "finance_profiles");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "payment_terms",
                table: "invoices",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "template_id",
                table: "invoices",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "invoice_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    jurisdiction = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    country_code = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    show_vat_id = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    show_tax_exemption_note = table.Column<bool>(type: "boolean", nullable: false),
                    tax_exemption_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    show_reverse_charge_note = table.Column<bool>(type: "boolean", nullable: false),
                    reverse_charge_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    show_payment_terms = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    default_payment_terms = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    show_bank_details = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    logo_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    header_text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    footer_text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    legal_notice = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    language = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false, defaultValue: "en"),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_invoice_templates", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_invoices_template_id",
                table: "invoices",
                column: "template_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_templates_jurisdiction_country_default",
                table: "invoice_templates",
                columns: new[] { "jurisdiction", "country_code", "is_default" },
                unique: true,
                filter: "is_default = true");

            migrationBuilder.AddForeignKey(
                name: "FK_invoices_invoice_templates_template_id",
                table: "invoices",
                column: "template_id",
                principalTable: "invoice_templates",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_invoices_invoice_templates_template_id",
                table: "invoices");

            migrationBuilder.DropTable(
                name: "invoice_templates");

            migrationBuilder.DropIndex(
                name: "IX_invoices_template_id",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "payment_terms",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "template_id",
                table: "invoices");
        }
    }
}

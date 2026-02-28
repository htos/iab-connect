using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceNumberCounter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "invoice_number_counters",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    finance_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    fiscal_year = table.Column<int>(type: "integer", nullable: false),
                    prefix = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    current_value = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_invoice_number_counters", x => x.id);
                    table.ForeignKey(
                        name: "FK_invoice_number_counters_finance_profiles_finance_profile_id",
                        column: x => x.finance_profile_id,
                        principalTable: "finance_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_number_counters_profile_year",
                table: "invoice_number_counters",
                columns: new[] { "finance_profile_id", "fiscal_year" },
                unique: true);

            // REQ-071: Seed counter from existing invoices so new numbers continue correctly.
            // For each fiscal year that has invoices, insert a counter row initialized to the
            // current max sequence number.
            migrationBuilder.Sql("""
                INSERT INTO invoice_number_counters (id, finance_profile_id, fiscal_year, prefix, current_value, updated_at)
                SELECT
                    gen_random_uuid(),
                    COALESCE(
                        (SELECT fp.id FROM finance_profiles fp WHERE fp.is_active = true LIMIT 1),
                        '00000000-0000-0000-0000-000000000001'::uuid
                    ),
                    EXTRACT(YEAR FROM i.date)::int AS fiscal_year,
                    'INV-' || EXTRACT(YEAR FROM i.date)::int || '-' AS prefix,
                    MAX(
                        CASE
                            WHEN i.invoice_number ~ '^INV-\d{4}-\d+$'
                            THEN CAST(SUBSTRING(i.invoice_number FROM '\d+$') AS int)
                            ELSE 0
                        END
                    ) AS current_value,
                    now() AS updated_at
                FROM invoices i
                WHERE i.invoice_number LIKE 'INV-%'
                GROUP BY EXTRACT(YEAR FROM i.date)::int
                ON CONFLICT (finance_profile_id, fiscal_year) DO NOTHING
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "invoice_number_counters");
        }
    }
}

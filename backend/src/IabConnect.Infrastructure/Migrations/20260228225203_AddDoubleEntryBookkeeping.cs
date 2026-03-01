using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDoubleEntryBookkeeping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "accounting_mode",
                table: "finance_profiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "SimpleCash");

            migrationBuilder.CreateTable(
                name: "journal_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    source_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    source_id = table.Column<Guid>(type: "uuid", nullable: true),
                    fiscal_period_id = table.Column<Guid>(type: "uuid", nullable: true),
                    finance_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reversal_of_entry_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    posted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    posted_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_journal_entries", x => x.id);
                    table.ForeignKey(
                        name: "FK_journal_entries_finance_profiles_finance_profile_id",
                        column: x => x.finance_profile_id,
                        principalTable: "finance_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_journal_entries_fiscal_periods_fiscal_period_id",
                        column: x => x.fiscal_period_id,
                        principalTable: "fiscal_periods",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_journal_entries_journal_entries_reversal_of_entry_id",
                        column: x => x.reversal_of_entry_id,
                        principalTable: "journal_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ledger_accounts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    account_class = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    normal_balance = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    parent_account_id = table.Column<Guid>(type: "uuid", nullable: true),
                    finance_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_ledger_accounts", x => x.id);
                    table.ForeignKey(
                        name: "FK_ledger_accounts_finance_profiles_finance_profile_id",
                        column: x => x.finance_profile_id,
                        principalTable: "finance_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ledger_accounts_ledger_accounts_parent_account_id",
                        column: x => x.parent_account_id,
                        principalTable: "ledger_accounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "journal_entry_lines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    journal_entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ledger_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    debit_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    credit_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    tax_code_id = table.Column<Guid>(type: "uuid", nullable: true),
                    net_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    tax_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    activity_area_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_journal_entry_lines", x => x.id);
                    table.ForeignKey(
                        name: "FK_journal_entry_lines_activity_areas_activity_area_id",
                        column: x => x.activity_area_id,
                        principalTable: "activity_areas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_journal_entry_lines_journal_entries_journal_entry_id",
                        column: x => x.journal_entry_id,
                        principalTable: "journal_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_journal_entry_lines_ledger_accounts_ledger_account_id",
                        column: x => x.ledger_account_id,
                        principalTable: "ledger_accounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_journal_entry_lines_tax_codes_tax_code_id",
                        column: x => x.tax_code_id,
                        principalTable: "tax_codes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "posting_mappings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    finance_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    mapping_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ledger_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tax_ledger_account_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_posting_mappings", x => x.id);
                    table.ForeignKey(
                        name: "FK_posting_mappings_finance_profiles_finance_profile_id",
                        column: x => x.finance_profile_id,
                        principalTable: "finance_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_posting_mappings_ledger_accounts_ledger_account_id",
                        column: x => x.ledger_account_id,
                        principalTable: "ledger_accounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_posting_mappings_ledger_accounts_tax_ledger_account_id",
                        column: x => x.tax_ledger_account_id,
                        principalTable: "ledger_accounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_journal_entries_date",
                table: "journal_entries",
                column: "date");

            migrationBuilder.CreateIndex(
                name: "ix_journal_entries_finance_profile_id",
                table: "journal_entries",
                column: "finance_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_journal_entries_fiscal_period_id",
                table: "journal_entries",
                column: "fiscal_period_id");

            migrationBuilder.CreateIndex(
                name: "IX_journal_entries_reversal_of_entry_id",
                table: "journal_entries",
                column: "reversal_of_entry_id");

            migrationBuilder.CreateIndex(
                name: "ix_journal_entries_source",
                table: "journal_entries",
                columns: new[] { "source_type", "source_id" });

            migrationBuilder.CreateIndex(
                name: "ix_journal_entries_status",
                table: "journal_entries",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_journal_entry_lines_activity_area_id",
                table: "journal_entry_lines",
                column: "activity_area_id");

            migrationBuilder.CreateIndex(
                name: "ix_journal_entry_lines_journal_entry_id",
                table: "journal_entry_lines",
                column: "journal_entry_id");

            migrationBuilder.CreateIndex(
                name: "ix_journal_entry_lines_ledger_account_id",
                table: "journal_entry_lines",
                column: "ledger_account_id");

            migrationBuilder.CreateIndex(
                name: "IX_journal_entry_lines_tax_code_id",
                table: "journal_entry_lines",
                column: "tax_code_id");

            migrationBuilder.CreateIndex(
                name: "ix_ledger_accounts_account_class",
                table: "ledger_accounts",
                column: "account_class");

            migrationBuilder.CreateIndex(
                name: "ix_ledger_accounts_finance_profile_id",
                table: "ledger_accounts",
                column: "finance_profile_id");

            migrationBuilder.CreateIndex(
                name: "IX_ledger_accounts_parent_account_id",
                table: "ledger_accounts",
                column: "parent_account_id");

            migrationBuilder.CreateIndex(
                name: "ix_ledger_accounts_profile_number_unique",
                table: "ledger_accounts",
                columns: new[] { "finance_profile_id", "number" },
                unique: true,
                filter: "is_deleted = false");

            migrationBuilder.CreateIndex(
                name: "ix_posting_mappings_finance_profile_id",
                table: "posting_mappings",
                column: "finance_profile_id");

            migrationBuilder.CreateIndex(
                name: "IX_posting_mappings_ledger_account_id",
                table: "posting_mappings",
                column: "ledger_account_id");

            migrationBuilder.CreateIndex(
                name: "ix_posting_mappings_profile_type_source_unique",
                table: "posting_mappings",
                columns: new[] { "finance_profile_id", "mapping_type", "source_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_posting_mappings_tax_ledger_account_id",
                table: "posting_mappings",
                column: "tax_ledger_account_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "journal_entry_lines");

            migrationBuilder.DropTable(
                name: "posting_mappings");

            migrationBuilder.DropTable(
                name: "journal_entries");

            migrationBuilder.DropTable(
                name: "ledger_accounts");

            migrationBuilder.DropColumn(
                name: "accounting_mode",
                table: "finance_profiles");
        }
    }
}

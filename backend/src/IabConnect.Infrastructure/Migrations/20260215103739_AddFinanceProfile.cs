using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "finance_profiles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    jurisdiction = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    country_code = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    fiscal_year_start_month = table.Column<int>(type: "integer", nullable: false),
                    organization_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    organization_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    organization_city = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    organization_postal_code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    organization_country = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    organization_email = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    organization_phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    organization_website = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    organization_uid = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    bank_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    bank_iban = table.Column<string>(type: "character varying(34)", maxLength: 34, nullable: true),
                    bank_bic = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_finance_profiles", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_finance_profiles_is_active_unique",
                table: "finance_profiles",
                column: "is_active",
                unique: true,
                filter: "is_active = true");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "finance_profiles");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFiscalPeriods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "fiscal_periods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    month = table.Column<int>(type: "integer", nullable: false),
                    start_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    end_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    locked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    locked_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    unlocked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    unlocked_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    lock_notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fiscal_periods", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_periods_year_month",
                table: "fiscal_periods",
                columns: new[] { "year", "month" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "fiscal_periods");
        }
    }
}

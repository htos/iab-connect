using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFiscalPeriodBalanceColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "closing_balance",
                table: "fiscal_periods",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "total_expense",
                table: "fiscal_periods",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "total_income",
                table: "fiscal_periods",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "closing_balance",
                table: "fiscal_periods");

            migrationBuilder.DropColumn(
                name: "total_expense",
                table: "fiscal_periods");

            migrationBuilder.DropColumn(
                name: "total_income",
                table: "fiscal_periods");
        }
    }
}

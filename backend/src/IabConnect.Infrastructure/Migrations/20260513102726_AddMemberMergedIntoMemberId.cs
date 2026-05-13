using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMemberMergedIntoMemberId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "merged_into_member_id",
                table: "members",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_members_merged_into_member_id",
                table: "members",
                column: "merged_into_member_id",
                filter: "merged_into_member_id IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_members_members_merged_into_member_id",
                table: "members",
                column: "merged_into_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_members_members_merged_into_member_id",
                table: "members");

            migrationBuilder.DropIndex(
                name: "ix_members_merged_into_member_id",
                table: "members");

            migrationBuilder.DropColumn(
                name: "merged_into_member_id",
                table: "members");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <summary>
    /// REQ-018 review patch: switches the members.merged_into_member_id self-FK from
    /// ON DELETE SET NULL to ON DELETE NO ACTION. With SET NULL, hard-deleting a target
    /// would silently null out the source's MergedIntoMemberId pointer, resurrecting the
    /// merged source row in GetAllNonMergedAsync and the duplicates UI. Restrict /
    /// NoAction forces target hard-deletes to fail until dependent merged-source rows are
    /// handled explicitly, preserving merge-history forensics.
    /// </summary>
    public partial class ChangeMergedIntoMemberFKToRestrict : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_members_members_merged_into_member_id",
                table: "members");

            migrationBuilder.AddForeignKey(
                name: "FK_members_members_merged_into_member_id",
                table: "members",
                column: "merged_into_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_members_members_merged_into_member_id",
                table: "members");

            migrationBuilder.AddForeignKey(
                name: "FK_members_members_merged_into_member_id",
                table: "members",
                column: "merged_into_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}

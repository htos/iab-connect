using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <summary>
    /// REQ-086 (E9-S1): Adds the organization-profile / white-label branding columns to
    /// <c>system_settings</c> so platform identity is admin-configurable without code
    /// changes. Seven new columns:
    /// <list type="bullet">
    ///   <item><c>description VARCHAR(2000) NULL</c> — organization description.</item>
    ///   <item><c>contact_email VARCHAR(320) NULL</c> — admin-only contact email.</item>
    ///   <item><c>contact_phone VARCHAR(50) NULL</c> — admin-only contact phone.</item>
    ///   <item><c>contact_address VARCHAR(500) NULL</c> — admin-only contact address.</item>
    ///   <item><c>primary_color VARCHAR(9) NULL</c> — primary brand color (hex).</item>
    ///   <item><c>public_site_enabled BOOLEAN NULL</c> — public-site toggle; <c>NULL</c>
    ///   and <c>true</c> both mean "enabled" (behaviour-preserving).</item>
    ///   <item><c>logo_asset_key VARCHAR(500) NULL</c> — storage key of the uploaded logo.</item>
    /// </list>
    ///
    /// <para><b>Behaviour-preserving:</b> every column is nullable with no default and no
    /// data backfill. The existing single <c>system_settings</c> row (and
    /// <c>SystemSettings.CreateDefault()</c>) stays valid with every new column <c>NULL</c>;
    /// <c>dotnet ef database update</c> on a populated DB adds columns only and changes no
    /// existing column.</para>
    ///
    /// <para><b>FK rationale:</b> no foreign keys are added or changed by this migration.</para>
    /// </summary>
    public partial class ExtendSystemSettingsBranding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "contact_address",
                table: "system_settings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contact_email",
                table: "system_settings",
                type: "character varying(320)",
                maxLength: 320,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contact_phone",
                table: "system_settings",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "system_settings",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "logo_asset_key",
                table: "system_settings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "primary_color",
                table: "system_settings",
                type: "character varying(9)",
                maxLength: 9,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "public_site_enabled",
                table: "system_settings",
                type: "boolean",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "contact_address",
                table: "system_settings");

            migrationBuilder.DropColumn(
                name: "contact_email",
                table: "system_settings");

            migrationBuilder.DropColumn(
                name: "contact_phone",
                table: "system_settings");

            migrationBuilder.DropColumn(
                name: "description",
                table: "system_settings");

            migrationBuilder.DropColumn(
                name: "logo_asset_key",
                table: "system_settings");

            migrationBuilder.DropColumn(
                name: "primary_color",
                table: "system_settings");

            migrationBuilder.DropColumn(
                name: "public_site_enabled",
                table: "system_settings");
        }
    }
}

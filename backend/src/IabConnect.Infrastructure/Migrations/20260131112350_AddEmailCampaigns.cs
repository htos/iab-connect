using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IabConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailCampaigns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "email_campaigns",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    subject = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    html_content = table.Column<string>(type: "text", nullable: false),
                    plain_text_content = table.Column<string>(type: "text", nullable: true),
                    from_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    from_email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    reply_to_email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    segment_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    segment_filter = table.Column<string>(type: "text", nullable: true),
                    event_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    scheduled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    total_recipients = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    sent_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    delivered_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    opened_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    clicked_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    bounced_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    failed_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    created_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_email_campaigns", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "email_recipients",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    campaign_id = table.Column<Guid>(type: "uuid", nullable: false),
                    member_id = table.Column<Guid>(type: "uuid", nullable: true),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    first_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    last_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    delivered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    opened_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    clicked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    bounced_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    unsubscribed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    bounce_type = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    bounce_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    error_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    external_message_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_email_recipients", x => x.id);
                    table.ForeignKey(
                        name: "FK_email_recipients_email_campaigns_campaign_id",
                        column: x => x.campaign_id,
                        principalTable: "email_campaigns",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_email_campaigns_created_at",
                table: "email_campaigns",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_email_campaigns_created_by_id",
                table: "email_campaigns",
                column: "created_by_id");

            migrationBuilder.CreateIndex(
                name: "IX_email_campaigns_scheduled_at",
                table: "email_campaigns",
                column: "scheduled_at");

            migrationBuilder.CreateIndex(
                name: "IX_email_campaigns_status",
                table: "email_campaigns",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_email_recipients_campaign_id",
                table: "email_recipients",
                column: "campaign_id");

            migrationBuilder.CreateIndex(
                name: "IX_email_recipients_campaign_id_email",
                table: "email_recipients",
                columns: new[] { "campaign_id", "email" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_email_recipients_email",
                table: "email_recipients",
                column: "email");

            migrationBuilder.CreateIndex(
                name: "IX_email_recipients_external_message_id",
                table: "email_recipients",
                column: "external_message_id");

            migrationBuilder.CreateIndex(
                name: "IX_email_recipients_member_id",
                table: "email_recipients",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "IX_email_recipients_status",
                table: "email_recipients",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "email_recipients");

            migrationBuilder.DropTable(
                name: "email_campaigns");
        }
    }
}

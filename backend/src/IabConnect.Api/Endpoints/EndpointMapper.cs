using IabConnect.Api.Endpoints;

namespace IabConnect.Api;

/// <summary>
/// Maps all API endpoints (Minimal APIs)
/// </summary>
public static class EndpointMapper
{
    public static WebApplication MapApiEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api/v1");

        // Public Endpoints (no auth required)
        app.MapRegistrationEndpoints(); // Public registration

        // Module Endpoints - REQ-001: Identity first
        api.MapIdentityEndpoints();
        app.MapUserEndpoints(); // REQ-002: Benutzerverwaltung (direct mapping, no prefix)
        api.MapMemberEndpoints();
        app.MapAuditEndpoints(); // REQ-011: Audit Log
        api.MapPrivacyEndpoints(); // REQ-012: Datenschutz & Einwilligungen (DSGVO)
        app.MapEventEndpoints(); // REQ-019: Eventverwaltung (uses EventEndpoints.cs)
        app.MapEventRegistrationEndpoints(); // REQ-020: Event-Anmeldung / RSVP
        app.MapEmailCampaignEndpoints(); // REQ-026: E-Mail-Kampagnen
        app.MapEmailTemplateEndpoints(); // REQ-027: Email Template Editor
        app.MapSettingsEndpoints(); // REQ-059: System Settings
        app.MapCustomRoleEndpoints(); // REQ-003: Custom Roles
        app.MapDocumentEndpoints(); // REQ-034..037: Documents
        api.MapCommunicationEndpoints();
        api.MapFinanceEndpoints();
        api.MapReportingEndpoints();

        // REQ-038-044: Finance module endpoints
        app.MapAccountEndpoints();
        app.MapCategoryEndpoints();
        app.MapTransactionEndpoints();
        app.MapInvoiceEndpoints();
        app.MapPaymentEndpoints();
        app.MapBankImportEndpoints();
        app.MapDunningEndpoints();
        app.MapReceiptEndpoints();
        app.MapFinanceExportEndpoints();

        return app;
    }

    // Identity endpoints moved to IdentityEndpoints.cs
    // Member endpoints moved to MemberEndpoints.cs
    // Event endpoints moved to EventEndpoints.cs

    private static RouteGroupBuilder MapCommunicationEndpoints(this RouteGroupBuilder group)
    {
        var comm = group.MapGroup("/communication")
            .WithTags("Communication")
            .RequireAuthorization("RequireVorstand");

        // REQ-026: Newsletter
        comm.MapPost("/newsletter", () =>
        {
            // TODO: Implement - sends newsletter
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("SendNewsletter")
        .WithDescription("REQ-026: Newsletter versenden");

        // REQ-027: Email notifications
        comm.MapPost("/notify", () =>
        {
            // TODO: Implement - sends notification
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("SendNotification")
        .WithDescription("REQ-027: Benachrichtigung versenden");

        return group;
    }

    private static RouteGroupBuilder MapFinanceEndpoints(this RouteGroupBuilder group)
    {
        // Finance endpoints are now in dedicated files:
        // AccountEndpoints, CategoryEndpoints, TransactionEndpoints,
        // InvoiceEndpoints, PaymentEndpoints, BankImportEndpoints,
        // DunningEndpoints, ReceiptEndpoints, FinanceExportEndpoints
        return group;
    }

    private static RouteGroupBuilder MapReportingEndpoints(this RouteGroupBuilder group)
    {
        var reports = group.MapGroup("/reports")
            .WithTags("Reporting")
            .RequireAuthorization("RequireVorstand");

        // REQ-050: Member statistics
        reports.MapGet("/members/statistics", () =>
        {
            // TODO: Implement - returns member statistics
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("GetReportMemberStatistics")
        .WithDescription("REQ-050: Mitgliederstatistiken");

        // REQ-051: Financial reports
        reports.MapGet("/finance", () =>
        {
            // TODO: Implement - returns financial report
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("GetFinancialReport")
        .WithDescription("REQ-051: Finanzberichte");

        // REQ-052: Export functionality
        reports.MapGet("/export/{type}", (string type) =>
        {
            // TODO: Implement - exports report as PDF/Excel
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("ExportReport")
        .WithDescription("REQ-052: Report exportieren (PDF/Excel)");

        return group;
    }
}

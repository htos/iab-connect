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
        api.MapEventEndpoints();
        api.MapDocumentEndpoints();
        api.MapCommunicationEndpoints();
        api.MapFinanceEndpoints();
        api.MapReportingEndpoints();

        return app;
    }

    // Identity endpoints moved to IdentityEndpoints.cs
    // Member endpoints moved to MemberEndpoints.cs

    private static RouteGroupBuilder MapEventEndpoints(this RouteGroupBuilder group)
    {
        var events = group.MapGroup("/events")
            .WithTags("Events");

        // REQ-019: Event calendar
        events.MapGet("/", () =>
        {
            // TODO: Implement - returns events list
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("GetEvents")
        .WithDescription("REQ-019: Eventkalender mit allen Veranstaltungen");

        // REQ-020: Event management (Vorstand only)
        events.MapPost("/", () =>
        {
            // TODO: Implement - creates new event
            return Results.Ok(new { Message = "Not implemented" });
        })
        .RequireAuthorization("RequireVorstand")
        .WithName("CreateEvent")
        .WithDescription("REQ-020: Event erstellen");

        events.MapPut("/{id:guid}", (Guid id) =>
        {
            // TODO: Implement - updates event
            return Results.Ok(new { Message = "Not implemented" });
        })
        .RequireAuthorization("RequireVorstand")
        .WithName("UpdateEvent")
        .WithDescription("REQ-020: Event bearbeiten");

        return group;
    }

    private static RouteGroupBuilder MapDocumentEndpoints(this RouteGroupBuilder group)
    {
        var documents = group.MapGroup("/documents")
            .WithTags("Documents")
            .RequireAuthorization("RequireMember");

        // REQ-034: Document management
        documents.MapGet("/", () =>
        {
            // TODO: Implement - returns document list
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("GetDocuments")
        .WithDescription("REQ-034: Dokumentenliste");

        documents.MapPost("/", () =>
        {
            // TODO: Implement - uploads document
            return Results.Ok(new { Message = "Not implemented" });
        })
        .RequireAuthorization("RequireVorstand")
        .WithName("UploadDocument")
        .WithDescription("REQ-034: Dokument hochladen");

        documents.MapGet("/{id:guid}/download", (Guid id) =>
        {
            // TODO: Implement - downloads document
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("DownloadDocument")
        .WithDescription("REQ-034: Dokument herunterladen");

        return group;
    }

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
        var finance = group.MapGroup("/finance")
            .WithTags("Finance")
            .RequireAuthorization("RequireVorstand");

        // REQ-038: Membership fees overview
        finance.MapGet("/fees", () =>
        {
            // TODO: Implement - returns fee overview
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("GetFeesOverview")
        .WithDescription("REQ-038: Übersicht Mitgliederbeiträge");

        // REQ-039: Payment tracking
        finance.MapGet("/payments", () =>
        {
            // TODO: Implement - returns payments list
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("GetPayments")
        .WithDescription("REQ-039: Zahlungsverfolgung");

        finance.MapPost("/payments", () =>
        {
            // TODO: Implement - records payment
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("RecordPayment")
        .WithDescription("REQ-039: Zahlung erfassen");

        // REQ-040: Payment reminders
        finance.MapPost("/reminders", () =>
        {
            // TODO: Implement - sends payment reminders
            return Results.Ok(new { Message = "Not implemented" });
        })
        .WithName("SendPaymentReminders")
        .WithDescription("REQ-040: Zahlungserinnerungen versenden");

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

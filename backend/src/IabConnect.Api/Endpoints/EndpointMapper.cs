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
        app.MapUnsubscribeEndpoints(); // REQ-029: Newsletter unsubscribe
        app.MapAboutEndpoints(); // REQ-089 AC-5 (E20-S3): AGPL §13 source-disclosure

        // Module Endpoints - REQ-001: Identity first
        api.MapIdentityEndpoints();
        app.MapUserEndpoints(); // REQ-002: Benutzerverwaltung (direct mapping, no prefix)
        api.MapMemberEndpoints();
        app.MapMemberSegmentEndpoints(); // REQ-017: Segmentierung & Verteiler
        app.MapAuditEndpoints(); // REQ-011: Audit Log
        api.MapPrivacyEndpoints(); // REQ-012: Datenschutz & Einwilligungen (DSGVO)
        app.MapEventEndpoints(); // REQ-019: Eventverwaltung (uses EventEndpoints.cs)
        app.MapEventRegistrationEndpoints(); // REQ-020: Event-Anmeldung / RSVP
        app.MapEventVolunteerEndpoints(); // REQ-024 (E3.S3): Volunteer planning (roles, shifts, assignments)
        app.MapEventFeeEndpoints(); // REQ-022 (E4-S1): Event fee categories (paid registration)
        app.MapEmailCampaignEndpoints(); // REQ-026: E-Mail-Kampagnen
        app.MapEmailTemplateEndpoints(); // REQ-027: Email Template Editor
        app.MapSettingsEndpoints(); // REQ-059: System Settings
        app.MapModuleSettingsEndpoints(); // REQ-087 (E10-S2): Module enablement configuration
        app.MapCustomRoleEndpoints(); // REQ-003: Custom Roles
        app.MapDocumentEndpoints(); // REQ-034..037: Documents

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
        app.MapFinanceProfileEndpoints();
        app.MapTaxCodeEndpoints();
        app.MapFiscalPeriodEndpoints(); // REQ-066: Fiscal Periods
        app.MapExpenseClaimEndpoints(); // REQ-067: Expense Claims
        app.MapInvoiceTemplateEndpoints(); // REQ-064: Invoice Templates
        app.MapActivityAreaEndpoints(); // REQ-068: Activity Areas
        app.MapDashboardEndpoints(); // Finance Dashboard overview
        app.MapArchiveEndpoints(); // REQ-070: Archive/Retention

        // REQ-031..033: Sponsors & Suppliers
        app.MapSponsorEndpoints();
        app.MapSupplierEndpoints();

        // REQ-047: Blog
        app.MapBlogEndpoints();

        // REQ-049: Contact form
        app.MapContactEndpoints();

        // REQ-074..085: Double-Entry Bookkeeping
        app.MapLedgerAccountEndpoints();
        app.MapJournalEntryEndpoints();
        app.MapPostingMappingEndpoints();
        app.MapAccountingReportEndpoints();

        // REQ-050/051: Reporting & Exports
        app.MapReportEndpoints();

        // REQ-052: Global Search
        app.MapSearchEndpoints();

        // REQ-053: Backup & Restore
        app.MapBackupEndpoints();

        // REQ-057: Retention Policies
        app.MapRetentionEndpoints();

        return app;
    }

}

using IabConnect.Api.Extensions;
using IabConnect.Application.Finance.Accounting;
using IabConnect.Application.Finance.Commands;
using IabConnect.Application.Finance.FinanceProfiles.Commands;
using IabConnect.Application.Finance.FinanceProfiles.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for finance profile management (REQ-060)
/// </summary>
public static class FinanceProfileEndpoints
{
    public static void MapFinanceProfileEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/profile")
            .WithTags("Finance - Profile");

        group.MapGet("/", GetActiveProfile)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetActiveFinanceProfile")
            .WithSummary("Get the active finance profile")
            .WithDescription("REQ-060: Returns the currently active finance profile, or 404 if none exists.");

        group.MapPost("/", CreateProfile)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateFinanceProfile")
            .WithSummary("Create a finance profile")
            .WithDescription("REQ-060: Creates a new finance profile. Deactivates any existing active profile.");

        group.MapPut("/{id:guid}", UpdateProfile)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdateFinanceProfile")
            .WithSummary("Update a finance profile")
            .WithDescription("REQ-060: Updates an existing finance profile.");

        // Finance Data Reset — admin-only, deletes ALL finance data
        routes.MapDelete("/api/v1/finance/reset", ResetAllFinanceData)
            .RequireAuthorization("RequireFinanceWrite")
            .WithTags("Finance - Profile")
            .WithName("ResetAllFinanceData")
            .WithSummary("Delete ALL finance data")
            .WithDescription("Irreversibly deletes all finance data including transactions, invoices, journal entries, accounts, etc.");

        // REQ-084: Backfill existing data when enabling DoubleEntry
        routes.MapPost("/api/v1/finance/backfill-double-entry", BackfillDoubleEntry)
            .RequireAuthorization("RequireFinanceWrite")
            .WithTags("Finance - Profile")
            .WithName("BackfillDoubleEntry")
            .WithSummary("Backfill journal entries for existing transactions/payments")
            .WithDescription("REQ-084: Creates journal entries for all existing transactions and paid payments from the given cut-off date. Idempotent – safe to re-run.");
    }

    private static async Task<IResult> GetActiveProfile(ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new GetActiveFinanceProfileQuery(), ct);
        return dto is null
            ? Results.NotFound(new { Message = "No active finance profile found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> CreateProfile(
        CreateFinanceProfileRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateFinanceProfileCommand
        {
            Jurisdiction = request.Jurisdiction,
            CountryCode = request.CountryCode,
            Currency = request.Currency,
            FiscalYearStartMonth = request.FiscalYearStartMonth,
            OrganizationName = request.OrganizationName,
            OrganizationAddress = request.OrganizationAddress,
            OrganizationCity = request.OrganizationCity,
            OrganizationPostalCode = request.OrganizationPostalCode,
            OrganizationCountry = request.OrganizationCountry,
            OrganizationEmail = request.OrganizationEmail,
            OrganizationPhone = request.OrganizationPhone,
            OrganizationWebsite = request.OrganizationWebsite,
            OrganizationUid = request.OrganizationUid,
            VatStatus = request.VatStatus,
            VatNumber = request.VatNumber,
            BankName = request.BankName,
            BankIban = request.BankIban,
            BankBic = request.BankBic
        }, ct);
        return Results.Created($"/api/v1/finance/profile/{dto.Id}", dto);
    }

    private static async Task<IResult> UpdateProfile(
        Guid id, UpdateFinanceProfileRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateFinanceProfileCommand
        {
            Id = id,
            Jurisdiction = request.Jurisdiction,
            CountryCode = request.CountryCode,
            Currency = request.Currency,
            FiscalYearStartMonth = request.FiscalYearStartMonth,
            OrganizationName = request.OrganizationName,
            OrganizationAddress = request.OrganizationAddress,
            OrganizationCity = request.OrganizationCity,
            OrganizationPostalCode = request.OrganizationPostalCode,
            OrganizationCountry = request.OrganizationCountry,
            OrganizationEmail = request.OrganizationEmail,
            OrganizationPhone = request.OrganizationPhone,
            OrganizationWebsite = request.OrganizationWebsite,
            OrganizationUid = request.OrganizationUid,
            VatStatus = request.VatStatus,
            VatNumber = request.VatNumber,
            BankName = request.BankName,
            BankIban = request.BankIban,
            BankBic = request.BankBic,
            AccountingMode = request.AccountingMode
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Finance profile not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> ResetAllFinanceData(
        HttpContext ctx, ISender sender, CancellationToken ct)
    {
        await sender.Send(new ResetAllFinanceDataCommand(ctx.GetUserName()), ct);
        return Results.Ok(new { Message = "All finance data has been deleted." });
    }

    private static async Task<IResult> BackfillDoubleEntry(
        BackfillDoubleEntryRequest request, HttpContext ctx, ISender sender, CancellationToken ct)
    {
        try
        {
            var result = await sender.Send(new BackfillDoubleEntryCommand
            {
                CutOffDate = request.CutOffDate,
                UserName = ctx.GetUserName()
            }, ct);
            return Results.Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { Message = ex.Message });
        }
    }

    // DTOs
    public sealed record BackfillDoubleEntryRequest(DateTime CutOffDate);

    public sealed record CreateFinanceProfileRequest(
        string Jurisdiction, string? CountryCode, string Currency, int FiscalYearStartMonth,
        string OrganizationName, string OrganizationAddress, string OrganizationCity,
        string OrganizationPostalCode, string OrganizationCountry,
        string? OrganizationEmail, string? OrganizationPhone, string? OrganizationWebsite,
        string? OrganizationUid, string? VatStatus, string? VatNumber,
        string? BankName, string? BankIban, string? BankBic);

    public sealed record UpdateFinanceProfileRequest(
        string Jurisdiction, string? CountryCode, string Currency, int FiscalYearStartMonth,
        string OrganizationName, string OrganizationAddress, string OrganizationCity,
        string OrganizationPostalCode, string OrganizationCountry,
        string? OrganizationEmail, string? OrganizationPhone, string? OrganizationWebsite,
        string? OrganizationUid, string? VatStatus, string? VatNumber,
        string? BankName, string? BankIban, string? BankBic,
        string? AccountingMode);
}

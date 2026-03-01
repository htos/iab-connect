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

    // DTOs
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

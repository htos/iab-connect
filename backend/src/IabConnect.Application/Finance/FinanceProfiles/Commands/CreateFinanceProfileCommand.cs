using IabConnect.Application.Finance.FinanceProfiles.Queries;
using MediatR;

namespace IabConnect.Application.Finance.FinanceProfiles.Commands;

/// <summary>
/// Command to create a finance profile (REQ-060). Deactivates any existing active profile.
/// </summary>
public sealed record CreateFinanceProfileCommand : IRequest<FinanceProfileDto>
{
    public required string Jurisdiction { get; init; }
    public string? CountryCode { get; init; }
    public required string Currency { get; init; }
    public required int FiscalYearStartMonth { get; init; }
    public required string OrganizationName { get; init; }
    public required string OrganizationAddress { get; init; }
    public required string OrganizationCity { get; init; }
    public required string OrganizationPostalCode { get; init; }
    public required string OrganizationCountry { get; init; }
    public string? OrganizationEmail { get; init; }
    public string? OrganizationPhone { get; init; }
    public string? OrganizationWebsite { get; init; }
    public string? OrganizationUid { get; init; }
    public string? VatStatus { get; init; }
    public string? VatNumber { get; init; }
    public string? BankName { get; init; }
    public string? BankIban { get; init; }
    public string? BankBic { get; init; }
}

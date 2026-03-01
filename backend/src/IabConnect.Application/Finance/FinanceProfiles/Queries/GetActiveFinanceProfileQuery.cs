using MediatR;

namespace IabConnect.Application.Finance.FinanceProfiles.Queries;

public sealed record FinanceProfileDto(
    Guid Id,
    string Jurisdiction,
    string? CountryCode,
    string Currency,
    int FiscalYearStartMonth,
    string OrganizationName,
    string OrganizationAddress,
    string OrganizationCity,
    string OrganizationPostalCode,
    string OrganizationCountry,
    string? OrganizationEmail,
    string? OrganizationPhone,
    string? OrganizationWebsite,
    string? OrganizationUid,
    string VatStatus,
    string? VatNumber,
    string? BankName,
    string? BankIban,
    string? BankBic,
    string AccountingMode,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Query to get the currently active finance profile (REQ-060)
/// </summary>
public sealed record GetActiveFinanceProfileQuery : IRequest<FinanceProfileDto?>;

using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.FinanceProfiles.Queries;

public sealed class GetActiveFinanceProfileQueryHandler
    : IRequestHandler<GetActiveFinanceProfileQuery, FinanceProfileDto?>
{
    private readonly IFinanceProfileRepository _repository;

    public GetActiveFinanceProfileQueryHandler(IFinanceProfileRepository repository)
    {
        _repository = repository;
    }

    public async Task<FinanceProfileDto?> Handle(GetActiveFinanceProfileQuery request, CancellationToken ct)
    {
        var profile = await _repository.GetActiveProfileAsync(ct);
        if (profile is null) return null;
        return MapToDto(profile);
    }

    internal static FinanceProfileDto MapToDto(FinanceProfile p) =>
        new(p.Id, p.Jurisdiction.ToString(), p.CountryCode, p.Currency.ToString(),
            p.FiscalYearStartMonth, p.OrganizationName, p.OrganizationAddress,
            p.OrganizationCity, p.OrganizationPostalCode, p.OrganizationCountry,
            p.OrganizationEmail, p.OrganizationPhone, p.OrganizationWebsite,
            p.OrganizationUid, p.VatStatus.ToString(), p.VatNumber,
            p.BankName, p.BankIban, p.BankBic, p.IsActive, p.CreatedAt, p.UpdatedAt);
}

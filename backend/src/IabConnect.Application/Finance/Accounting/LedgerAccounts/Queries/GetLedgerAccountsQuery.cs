using MediatR;

namespace IabConnect.Application.Finance.Accounting.LedgerAccounts.Queries;

/// <summary>
/// REQ-075: Query all ledger accounts for the active finance profile.
/// </summary>
public sealed record GetLedgerAccountsQuery : IRequest<List<LedgerAccountDto>>;

public sealed class GetLedgerAccountsQueryHandler : IRequestHandler<GetLedgerAccountsQuery, List<LedgerAccountDto>>
{
    private readonly ILedgerAccountRepository _repository;
    private readonly IFinanceProfileRepository _profileRepo;

    public GetLedgerAccountsQueryHandler(
        ILedgerAccountRepository repository,
        IFinanceProfileRepository profileRepo)
    {
        _repository = repository;
        _profileRepo = profileRepo;
    }

    public async Task<List<LedgerAccountDto>> Handle(GetLedgerAccountsQuery request, CancellationToken ct)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct)
            ?? throw new InvalidOperationException("No active finance profile found.");

        var accounts = await _repository.GetAllByProfileAsync(profile.Id, ct);
        return accounts.Select(AccountingDtoMapper.MapToDto).ToList();
    }
}

using MediatR;

namespace IabConnect.Application.Finance.Accounts.Queries;

public sealed class GetAccountsQueryHandler : IRequestHandler<GetAccountsQuery, List<AccountDto>>
{
    private readonly IAccountRepository _repository;

    public GetAccountsQueryHandler(IAccountRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<AccountDto>> Handle(GetAccountsQuery request, CancellationToken ct)
    {
        var accounts = await _repository.GetAllAsync(ct);
        return accounts.Select(a => new AccountDto(
            a.Id, a.Name, a.Number, a.Type.ToString(), a.Description,
            a.IsActive, a.SortOrder, a.CreatedAt, a.CreatedBy,
            a.UpdatedAt, a.UpdatedBy)).ToList();
    }
}

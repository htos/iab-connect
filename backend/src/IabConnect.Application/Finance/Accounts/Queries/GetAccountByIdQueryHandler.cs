using MediatR;

namespace IabConnect.Application.Finance.Accounts.Queries;

public sealed class GetAccountByIdQueryHandler : IRequestHandler<GetAccountByIdQuery, AccountDto?>
{
    private readonly IAccountRepository _repository;

    public GetAccountByIdQueryHandler(IAccountRepository repository)
    {
        _repository = repository;
    }

    public async Task<AccountDto?> Handle(GetAccountByIdQuery request, CancellationToken ct)
    {
        var account = await _repository.GetByIdAsync(request.Id, ct);
        if (account is null) return null;

        return new AccountDto(
            account.Id, account.Name, account.Number, account.Type.ToString(),
            account.Description, account.IsActive, account.SortOrder,
            account.CreatedAt, account.CreatedBy, account.UpdatedAt, account.UpdatedBy);
    }
}

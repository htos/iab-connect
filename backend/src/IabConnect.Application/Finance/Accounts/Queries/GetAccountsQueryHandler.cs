using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.Accounts.Queries;

public sealed class GetAccountsQueryHandler : IRequestHandler<GetAccountsQuery, PagedResult<AccountDto>>
{
    private readonly IAccountRepository _repository;

    public GetAccountsQueryHandler(IAccountRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<AccountDto>> Handle(GetAccountsQuery request, CancellationToken ct)
    {
        var accounts = await _repository.GetAllAsync(ct);
        var dtos = accounts.Select(a => new AccountDto(
            a.Id, a.Name, a.Number, a.Type.ToString(), a.Description,
            a.IsActive, a.SortOrder, a.CreatedAt, a.CreatedBy,
            a.UpdatedAt, a.UpdatedBy));

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "sortOrder", false);
        var sorted = field.ToLowerInvariant() switch
        {
            "name" => dtos.ApplySort(a => a.Name, desc),
            "number" => dtos.ApplySort(a => a.Number, desc),
            "createdat" => dtos.ApplySort(a => a.CreatedAt, desc),
            _ => dtos.ApplySort(a => a.SortOrder, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }
}

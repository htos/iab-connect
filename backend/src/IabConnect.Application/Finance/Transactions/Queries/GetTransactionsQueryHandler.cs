using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Queries;

public sealed class GetTransactionsQueryHandler : IRequestHandler<GetTransactionsQuery, PagedResult<TransactionDto>>
{
    private readonly ITransactionRepository _repository;

    public GetTransactionsQueryHandler(ITransactionRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<TransactionDto>> Handle(GetTransactionsQuery request, CancellationToken ct)
    {
        TransactionType? txType = null;
        if (!string.IsNullOrEmpty(request.Type) && Enum.TryParse<TransactionType>(request.Type, true, out var parsed))
            txType = parsed;

        var from = request.From.HasValue ? DateTime.SpecifyKind(request.From.Value, DateTimeKind.Utc) : (DateTime?)null;
        var to = request.To.HasValue ? DateTime.SpecifyKind(request.To.Value, DateTimeKind.Utc) : (DateTime?)null;

        var transactions = await _repository.GetAllAsync(from, to, txType, ct: ct);
        var dtos = transactions.Select(MapToDto);

        // Apply additional filters from the filter string
        var filters = PaginationHelper.ParseFilter(request.Filter);
        if (filters.TryGetValue("categoryId", out var catId) && Guid.TryParse(catId, out var categoryId))
            dtos = dtos.Where(t => t.CategoryId == categoryId);
        if (filters.TryGetValue("accountId", out var accId) && Guid.TryParse(accId, out var accountId))
            dtos = dtos.Where(t => t.AccountId == accountId);

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "date", true);
        var sorted = field.ToLowerInvariant() switch
        {
            "amount" => dtos.ApplySort(t => t.Amount, desc),
            "description" => dtos.ApplySort(t => t.Description, desc),
            "createdat" => dtos.ApplySort(t => t.CreatedAt, desc),
            _ => dtos.ApplySort(t => t.Date, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }

    internal static TransactionDto MapToDto(Transaction t) =>
        new(t.Id, t.Date, t.Description, t.Amount, t.Type.ToString(),
            t.AccountId, t.CategoryId, t.Reference, t.Notes, t.ReceiptId,
            t.TaxCodeId, t.TaxRate, t.TaxAmount, t.NetAmount,
            t.ActivityAreaId, t.ActivityArea?.Name, t.ActivityArea?.Code,
            t.CreatedAt, t.CreatedBy, t.UpdatedAt, t.UpdatedBy);
}

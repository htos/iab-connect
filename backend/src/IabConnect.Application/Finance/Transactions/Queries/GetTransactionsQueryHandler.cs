using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Queries;

public sealed class GetTransactionsQueryHandler : IRequestHandler<GetTransactionsQuery, List<TransactionDto>>
{
    private readonly ITransactionRepository _repository;

    public GetTransactionsQueryHandler(ITransactionRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<TransactionDto>> Handle(GetTransactionsQuery request, CancellationToken ct)
    {
        TransactionType? txType = null;
        if (!string.IsNullOrEmpty(request.Type) && Enum.TryParse<TransactionType>(request.Type, true, out var parsed))
            txType = parsed;

        var from = request.From.HasValue ? DateTime.SpecifyKind(request.From.Value, DateTimeKind.Utc) : (DateTime?)null;
        var to = request.To.HasValue ? DateTime.SpecifyKind(request.To.Value, DateTimeKind.Utc) : (DateTime?)null;

        var transactions = await _repository.GetAllAsync(from, to, txType, ct);
        return transactions.Select(MapToDto).ToList();
    }

    internal static TransactionDto MapToDto(Transaction t) =>
        new(t.Id, t.Date, t.Description, t.Amount, t.Type.ToString(),
            t.AccountId, t.CategoryId, t.Reference, t.Notes, t.ReceiptId,
            t.TaxCodeId, t.TaxRate, t.TaxAmount, t.NetAmount,
            t.ActivityAreaId, t.ActivityArea?.Name, t.ActivityArea?.Code,
            t.CreatedAt, t.CreatedBy, t.UpdatedAt, t.UpdatedBy);
}

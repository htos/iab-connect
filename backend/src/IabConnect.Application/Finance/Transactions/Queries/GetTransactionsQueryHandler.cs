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

        var transactions = await _repository.GetAllAsync(request.From, request.To, txType, ct);
        return transactions.Select(MapToDto).ToList();
    }

    internal static TransactionDto MapToDto(Transaction t) =>
        new(t.Id, t.Date, t.Description, t.Amount, t.Type.ToString(),
            t.AccountId, t.CategoryId, t.Reference, t.Notes, t.ReceiptId,
            t.TaxCodeId, t.TaxRate, t.TaxAmount, t.NetAmount,
            t.CreatedAt, t.CreatedBy, t.UpdatedAt, t.UpdatedBy);
}

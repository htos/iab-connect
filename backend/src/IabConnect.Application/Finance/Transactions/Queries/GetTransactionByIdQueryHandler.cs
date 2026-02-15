using MediatR;

namespace IabConnect.Application.Finance.Transactions.Queries;

public sealed class GetTransactionByIdQueryHandler : IRequestHandler<GetTransactionByIdQuery, TransactionDto?>
{
    private readonly ITransactionRepository _repository;

    public GetTransactionByIdQueryHandler(ITransactionRepository repository)
    {
        _repository = repository;
    }

    public async Task<TransactionDto?> Handle(GetTransactionByIdQuery request, CancellationToken ct)
    {
        var transaction = await _repository.GetByIdAsync(request.Id, ct);
        if (transaction is null) return null;
        return GetTransactionsQueryHandler.MapToDto(transaction);
    }
}

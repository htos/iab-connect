using MediatR;

namespace IabConnect.Application.Finance.Transactions.Queries;

public sealed class GetTransactionSummaryQueryHandler : IRequestHandler<GetTransactionSummaryQuery, TransactionSummaryDto>
{
    private readonly ITransactionRepository _repository;

    public GetTransactionSummaryQueryHandler(ITransactionRepository repository)
    {
        _repository = repository;
    }

    public async Task<TransactionSummaryDto> Handle(GetTransactionSummaryQuery request, CancellationToken ct)
    {
        var from = request.From.HasValue ? DateTime.SpecifyKind(request.From.Value, DateTimeKind.Utc) : (DateTime?)null;
        var to = request.To.HasValue ? DateTime.SpecifyKind(request.To.Value, DateTimeKind.Utc) : (DateTime?)null;

        var (totalIncome, totalExpense) = await _repository.GetSummaryAsync(from, to, ct);
        return new TransactionSummaryDto(totalIncome, totalExpense, totalIncome - totalExpense);
    }
}

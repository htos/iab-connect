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
        var (totalIncome, totalExpense) = await _repository.GetSummaryAsync(request.From, request.To, ct);
        return new TransactionSummaryDto(totalIncome, totalExpense, totalIncome - totalExpense);
    }
}

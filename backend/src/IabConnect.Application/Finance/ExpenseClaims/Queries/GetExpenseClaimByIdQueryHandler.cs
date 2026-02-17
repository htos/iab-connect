using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Queries;

public sealed class GetExpenseClaimByIdQueryHandler : IRequestHandler<GetExpenseClaimByIdQuery, ExpenseClaimDto?>
{
    private readonly IExpenseClaimRepository _repository;

    public GetExpenseClaimByIdQueryHandler(IExpenseClaimRepository repository)
    {
        _repository = repository;
    }

    public async Task<ExpenseClaimDto?> Handle(GetExpenseClaimByIdQuery request, CancellationToken ct)
    {
        var claim = await _repository.GetByIdAsync(request.Id, ct);
        if (claim is null) return null;
        return GetExpenseClaimsQueryHandler.MapToDto(claim);
    }
}

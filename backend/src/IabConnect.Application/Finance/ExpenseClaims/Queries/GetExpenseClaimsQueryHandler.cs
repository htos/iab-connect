using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Queries;

public sealed class GetExpenseClaimsQueryHandler : IRequestHandler<GetExpenseClaimsQuery, List<ExpenseClaimDto>>
{
    private readonly IExpenseClaimRepository _repository;

    public GetExpenseClaimsQueryHandler(IExpenseClaimRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<ExpenseClaimDto>> Handle(GetExpenseClaimsQuery request, CancellationToken ct)
    {
        var claims = await _repository.GetAllAsync(request.Status, request.ClaimantId, ct);
        return claims.Select(MapToDto).ToList();
    }

    internal static ExpenseClaimDto MapToDto(ExpenseClaim e) =>
        new(
            e.Id, e.Title, e.Description, e.Amount, e.Currency.ToString(),
            e.Date, e.Status.ToString(), e.ClaimantId, e.ClaimantName,
            e.ReceiptId, e.ReviewedBy, e.ReviewedAt, e.ReviewComment,
            e.ApprovedBy, e.ApprovedAt, e.ApprovalComment,
            e.RejectedBy, e.RejectedAt, e.RejectionReason,
            e.PaymentId, e.ReimbursedAt, e.ReimbursedBy,
            e.CreatedAt, e.CreatedBy);
}

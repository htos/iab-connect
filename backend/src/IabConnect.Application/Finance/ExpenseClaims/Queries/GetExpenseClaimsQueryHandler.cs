using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Queries;

public sealed class GetExpenseClaimsQueryHandler : IRequestHandler<GetExpenseClaimsQuery, PagedResult<ExpenseClaimDto>>
{
    private readonly IExpenseClaimRepository _repository;

    public GetExpenseClaimsQueryHandler(IExpenseClaimRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<ExpenseClaimDto>> Handle(GetExpenseClaimsQuery request, CancellationToken ct)
    {
        var claims = await _repository.GetAllAsync(request.Status, request.ClaimantId, ct);
        var dtos = claims.Select(MapToDto);

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "date", true);
        var sorted = field.ToLowerInvariant() switch
        {
            "amount" => dtos.ApplySort(e => e.Amount, desc),
            "status" => dtos.ApplySort(e => e.Status, desc),
            "title" => dtos.ApplySort(e => e.Title, desc),
            "createdat" => dtos.ApplySort(e => e.CreatedAt, desc),
            _ => dtos.ApplySort(e => e.Date, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
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

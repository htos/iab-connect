using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Queries;

public sealed class GetPaymentsQueryHandler : IRequestHandler<GetPaymentsQuery, PagedResult<PaymentDto>>
{
    private readonly IPaymentRepository _repository;

    public GetPaymentsQueryHandler(IPaymentRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<PaymentDto>> Handle(GetPaymentsQuery request, CancellationToken ct)
    {
        var payments = await _repository.GetAllAsync(ct);
        IEnumerable<PaymentDto> dtos = payments.Select(MapToDto);

        // Apply filters from the filter string
        var filters = PaginationHelper.ParseFilter(request.Filter);
        if (filters.TryGetValue("status", out var status) && Enum.TryParse<PaymentStatus>(status, true, out var ps))
            dtos = dtos.Where(p => p.Status.Equals(ps.ToString(), StringComparison.OrdinalIgnoreCase));
        if (filters.TryGetValue("direction", out var dir) && Enum.TryParse<PaymentDirection>(dir, true, out var pd))
            dtos = dtos.Where(p => p.Direction.Equals(pd.ToString(), StringComparison.OrdinalIgnoreCase));

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "date", true);
        var sorted = field.ToLowerInvariant() switch
        {
            "amount" => dtos.ApplySort(p => p.Amount, desc),
            "status" => dtos.ApplySort(p => p.Status, desc),
            "createdat" => dtos.ApplySort(p => p.CreatedAt, desc),
            _ => dtos.ApplySort(p => p.Date, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }

    internal static PaymentDto MapToDto(Payment p) =>
        new(p.Id, p.Date, p.Amount, p.Direction.ToString(), p.Method.ToString(), p.Reference,
            p.InvoiceId, p.Invoice?.InvoiceNumber, p.TransactionId, p.Notes,
            p.Status.ToString(), p.ApprovedBy, p.ApprovedAt, p.ApprovalComment,
            p.RejectedBy, p.RejectedAt, p.RejectionReason,
            p.ReceiptId,
            p.CreatedAt, p.CreatedBy, p.UpdatedAt, p.UpdatedBy);
}

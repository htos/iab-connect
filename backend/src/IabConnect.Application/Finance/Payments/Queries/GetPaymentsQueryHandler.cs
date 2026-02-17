using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Queries;

public sealed class GetPaymentsQueryHandler : IRequestHandler<GetPaymentsQuery, List<PaymentDto>>
{
    private readonly IPaymentRepository _repository;

    public GetPaymentsQueryHandler(IPaymentRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<PaymentDto>> Handle(GetPaymentsQuery request, CancellationToken ct)
    {
        var payments = await _repository.GetAllAsync(ct);
        return payments.Select(MapToDto).ToList();
    }

    internal static PaymentDto MapToDto(Payment p) =>
        new(p.Id, p.Date, p.Amount, p.Direction.ToString(), p.Method.ToString(), p.Reference,
            p.InvoiceId, p.Invoice?.InvoiceNumber, p.TransactionId, p.Notes,
            p.Status.ToString(), p.ApprovedBy, p.ApprovedAt, p.ApprovalComment,
            p.RejectedBy, p.RejectedAt, p.RejectionReason,
            p.ReceiptId,
            p.CreatedAt, p.CreatedBy, p.UpdatedAt, p.UpdatedBy);
}

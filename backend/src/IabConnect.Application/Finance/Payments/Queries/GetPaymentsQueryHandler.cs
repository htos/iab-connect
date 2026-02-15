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
        new(p.Id, p.Date, p.Amount, p.Method.ToString(), p.Reference,
            p.InvoiceId, p.TransactionId, p.Notes,
            p.CreatedAt, p.CreatedBy, p.UpdatedAt, p.UpdatedBy);
}

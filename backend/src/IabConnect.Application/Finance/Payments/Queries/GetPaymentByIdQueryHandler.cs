using MediatR;

namespace IabConnect.Application.Finance.Payments.Queries;

public sealed class GetPaymentByIdQueryHandler : IRequestHandler<GetPaymentByIdQuery, PaymentDto?>
{
    private readonly IPaymentRepository _repository;

    public GetPaymentByIdQueryHandler(IPaymentRepository repository)
    {
        _repository = repository;
    }

    public async Task<PaymentDto?> Handle(GetPaymentByIdQuery request, CancellationToken ct)
    {
        var payment = await _repository.GetByIdAsync(request.Id, ct);
        if (payment is null) return null;
        return GetPaymentsQueryHandler.MapToDto(payment);
    }
}

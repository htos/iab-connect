using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.BankImports.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

public sealed class MatchBankImportItemCommandHandler
    : IRequestHandler<MatchBankImportItemCommand, BankImportItemDto?>
{
    private readonly IBankImportRepository _repository;
    private readonly IPaymentRepository _paymentRepository;
    private readonly IAutoBookingService _autoBookingService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public MatchBankImportItemCommandHandler(
        IBankImportRepository repository,
        IPaymentRepository paymentRepository,
        IAutoBookingService autoBookingService,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _paymentRepository = paymentRepository;
        _autoBookingService = autoBookingService;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<BankImportItemDto?> Handle(MatchBankImportItemCommand request, CancellationToken ct)
    {
        var bankImport = await _repository.GetByIdAsync(request.BankImportId, ct);
        if (bankImport is null) return null;

        var item = bankImport.Items.FirstOrDefault(i => i.Id == request.ItemId);
        if (item is null) return null;

        item.MatchToPayment(request.PaymentId);

        // Mark payment as paid and auto-book a ledger transaction
        var payment = await _paymentRepository.GetByIdAsync(request.PaymentId, ct);
        if (payment is not null && payment.Status is PaymentStatus.Draft or PaymentStatus.Approved)
        {
            payment.MarkAsPaid(request.UserName);

            if (payment.TransactionId is null)
            {
                await _autoBookingService.CreateTransactionForPaymentAsync(payment, request.UserName, ct);
            }

            await _paymentRepository.UpdateAsync(payment, ct);
        }

        if (bankImport.Items.All(i => i.Status != BankImportItemStatus.Unmatched))
            bankImport.MarkAsProcessed();

        await _repository.UpdateAsync(bankImport, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Bank import item matched to payment {request.PaymentId}",
            entityType: "BankImportItem",
            entityId: request.ItemId.ToString(),
            ct: ct);

        return GetBankImportsQueryHandler.MapItemDto(item);
    }
}

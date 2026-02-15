using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Invoices.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class CancelInvoiceCommandHandler
    : IRequestHandler<CancelInvoiceCommand, Result<InvoiceDetailDto>>
{
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CancelInvoiceCommandHandler(
        IInvoiceRepository invoiceRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _invoiceRepository = invoiceRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<Result<InvoiceDetailDto>> Handle(CancelInvoiceCommand request, CancellationToken ct)
    {
        var invoice = await _invoiceRepository.GetByIdAsync(request.Id, ct);
        if (invoice is null)
            return Result<InvoiceDetailDto>.Failure("Invoice not found.");

        try
        {
            invoice.Cancel(request.Reason, request.UserName);
        }
        catch (InvalidOperationException ex)
        {
            return Result<InvoiceDetailDto>.Failure(ex.Message);
        }

        // Create storno reversal transaction
        var stornoTransaction = Transaction.Create(
            DateTime.UtcNow,
            $"STORNO: {invoice.InvoiceNumber} - {invoice.RecipientName}",
            invoice.Total,
            TransactionType.Expense,
            request.AccountId,
            null,
            $"STORNO-{invoice.InvoiceNumber}",
            $"Storno for cancelled invoice {invoice.InvoiceNumber}. Reason: {request.Reason}",
            request.UserName);

        await _transactionRepository.AddAsync(stornoTransaction, ct);
        await _invoiceRepository.UpdateAsync(invoice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            $"Invoice '{invoice.InvoiceNumber}' cancelled (storno). Reason: {request.Reason}",
            entityType: "Invoice",
            entityId: invoice.Id.ToString(),
            ct: ct);

        return Result<InvoiceDetailDto>.Success(GetInvoicesQueryHandler.MapToDetailDto(invoice));
    }
}

using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.DunningNotices.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.DunningNotices.Commands;

public sealed class SendDunningNoticeCommandHandler
    : IRequestHandler<SendDunningNoticeCommand, DunningNoticeDto?>
{
    private readonly IDunningNoticeRepository _repository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public SendDunningNoticeCommandHandler(
        IDunningNoticeRepository repository,
        IInvoiceRepository invoiceRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _invoiceRepository = invoiceRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<DunningNoticeDto?> Handle(SendDunningNoticeCommand request, CancellationToken ct)
    {
        var notice = await _repository.GetByIdAsync(request.Id, ct);
        if (notice is null) return null;

        notice.MarkAsSent();

        await _repository.UpdateAsync(notice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        var invoice = await _invoiceRepository.GetByIdAsync(notice.InvoiceId, ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            $"Dunning notice level {notice.Level} marked as sent",
            entityType: "DunningNotice",
            entityId: notice.Id.ToString(),
            ct: ct);

        return GetDunningNoticesQueryHandler.MapToDto(notice, invoice?.InvoiceNumber, invoice?.RecipientName);
    }
}

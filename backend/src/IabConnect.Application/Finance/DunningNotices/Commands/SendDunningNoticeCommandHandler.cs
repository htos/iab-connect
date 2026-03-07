using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.DunningNotices.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;
using Microsoft.Extensions.Logging;

namespace IabConnect.Application.Finance.DunningNotices.Commands;

public sealed class SendDunningNoticeCommandHandler
    : IRequestHandler<SendDunningNoticeCommand, DunningNoticeDto?>
{
    private readonly IDunningNoticeRepository _repository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;
    private readonly IDunningEmailService _dunningEmailService;
    private readonly ILogger<SendDunningNoticeCommandHandler> _logger;

    public SendDunningNoticeCommandHandler(
        IDunningNoticeRepository repository,
        IInvoiceRepository invoiceRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        IDunningEmailService dunningEmailService,
        ILogger<SendDunningNoticeCommandHandler> logger)
    {
        _repository = repository;
        _invoiceRepository = invoiceRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
        _dunningEmailService = dunningEmailService;
        _logger = logger;
    }

    public async Task<DunningNoticeDto?> Handle(SendDunningNoticeCommand request, CancellationToken ct)
    {
        var notice = await _repository.GetByIdAsync(request.Id, ct);
        if (notice is null) return null;

        var invoice = await _invoiceRepository.GetByIdAsync(notice.InvoiceId, ct);
        if (invoice is null) return null;

        // TECH-003: Send dunning email before marking as sent
        var emailSent = await _dunningEmailService.SendDunningEmailAsync(notice, invoice, ct);
        if (!emailSent)
        {
            _logger.LogWarning(
                "Dunning notice {NoticeId} marked as sent without email — recipient email not resolvable",
                notice.Id);
        }

        notice.MarkAsSent();

        await _repository.UpdateAsync(notice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            emailSent
                ? $"Dunning notice level {notice.Level} sent via email for invoice '{invoice.InvoiceNumber}'"
                : $"Dunning notice level {notice.Level} marked as sent (no email — recipient email not found)",
            entityType: "DunningNotice",
            entityId: notice.Id.ToString(),
            ct: ct);

        return GetDunningNoticesQueryHandler.MapToDto(notice, invoice.InvoiceNumber, invoice.RecipientName);
    }
}

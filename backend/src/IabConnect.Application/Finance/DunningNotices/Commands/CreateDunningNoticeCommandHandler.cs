using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.DunningNotices.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.DunningNotices.Commands;

public sealed class CreateDunningNoticeCommandHandler
    : IRequestHandler<CreateDunningNoticeCommand, DunningNoticeDto?>
{
    private readonly IDunningNoticeRepository _dunningRepository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateDunningNoticeCommandHandler(
        IDunningNoticeRepository dunningRepository,
        IInvoiceRepository invoiceRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _dunningRepository = dunningRepository;
        _invoiceRepository = invoiceRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<DunningNoticeDto?> Handle(CreateDunningNoticeCommand request, CancellationToken ct)
    {
        var invoice = await _invoiceRepository.GetByIdAsync(request.InvoiceId, ct);
        if (invoice is null) return null;

        var notice = DunningNotice.Create(
            request.InvoiceId, request.Level, request.DueDate,
            request.Notes, request.UserName);

        await _dunningRepository.AddAsync(notice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Dunning notice level {notice.Level} created for invoice '{invoice.InvoiceNumber}'",
            entityType: "DunningNotice",
            entityId: notice.Id.ToString(),
            ct: ct);

        return GetDunningNoticesQueryHandler.MapToDto(notice, invoice.InvoiceNumber, invoice.RecipientName);
    }
}

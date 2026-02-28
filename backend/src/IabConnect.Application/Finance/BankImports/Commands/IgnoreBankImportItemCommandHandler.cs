using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.BankImports.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

public sealed class IgnoreBankImportItemCommandHandler
    : IRequestHandler<IgnoreBankImportItemCommand, BankImportItemDto?>
{
    private readonly IBankImportRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public IgnoreBankImportItemCommandHandler(
        IBankImportRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<BankImportItemDto?> Handle(IgnoreBankImportItemCommand request, CancellationToken ct)
    {
        var bankImport = await _repository.GetByIdAsync(request.BankImportId, ct);
        if (bankImport is null) return null;

        var item = bankImport.Items.FirstOrDefault(i => i.Id == request.ItemId);
        if (item is null) return null;

        item.Ignore();

        if (bankImport.Items.All(i => i.Status != BankImportItemStatus.Unmatched))
            bankImport.MarkAsProcessed();

        await _repository.UpdateAsync(bankImport, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Bank import item ignored",
            entityType: "BankImportItem",
            entityId: request.ItemId.ToString(),
            ct: ct);

        return GetBankImportsQueryHandler.MapItemDto(item);
    }
}

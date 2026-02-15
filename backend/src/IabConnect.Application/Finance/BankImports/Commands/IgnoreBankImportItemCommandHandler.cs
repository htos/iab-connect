using IabConnect.Application.Common;
using IabConnect.Application.Finance.BankImports.Queries;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

public sealed class IgnoreBankImportItemCommandHandler
    : IRequestHandler<IgnoreBankImportItemCommand, BankImportItemDto?>
{
    private readonly IBankImportRepository _repository;
    private readonly IUnitOfWork _unitOfWork;

    public IgnoreBankImportItemCommandHandler(
        IBankImportRepository repository,
        IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
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

        return GetBankImportsQueryHandler.MapItemDto(item);
    }
}

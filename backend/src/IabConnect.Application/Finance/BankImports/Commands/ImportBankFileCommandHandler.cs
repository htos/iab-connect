using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.BankImports.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

public sealed class ImportBankFileCommandHandler : IRequestHandler<ImportBankFileCommand, BankImportDto>
{
    private readonly IBankImportRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public ImportBankFileCommandHandler(
        IBankImportRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<BankImportDto> Handle(ImportBankFileCommand request, CancellationToken ct)
    {
        var bankImport = BankImport.Create(request.FileName, request.UserName);

        foreach (var row in request.Rows)
        {
            var item = BankImportItem.Create(
                bankImport.Id, row.TransactionDate, row.Description,
                row.Amount, row.Iban, row.Reference);
            bankImport.AddItem(item);
        }

        await _repository.AddAsync(bankImport, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Bank import '{bankImport.FileName}' uploaded with {request.Rows.Count} rows",
            entityType: "BankImport",
            entityId: bankImport.Id.ToString(),
            ct: ct);

        return GetBankImportsQueryHandler.MapToDto(bankImport);
    }
}

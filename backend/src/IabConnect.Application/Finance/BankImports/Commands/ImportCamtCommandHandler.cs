using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.BankImports.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

/// <summary>
/// REQ-069: Handler for camt.053/054 XML import.
/// Parses the XML, creates items with reference fields, runs auto-matching.
/// </summary>
public sealed class ImportCamtCommandHandler : IRequestHandler<ImportCamtCommand, BankImportDto>
{
    private readonly ICamtParser _camtParser;
    private readonly IBankImportMatcher _matcher;
    private readonly IBankImportRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public ImportCamtCommandHandler(
        ICamtParser camtParser,
        IBankImportMatcher matcher,
        IBankImportRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _camtParser = camtParser;
        _matcher = matcher;
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<BankImportDto> Handle(ImportCamtCommand request, CancellationToken ct)
    {
        // 1. Parse camt XML
        var parseResult = await _camtParser.ParseAsync(request.FileStream, ct);

        // 2. Determine format from the parse result
        var format = parseResult.StatementId is not null
            ? BankImportFormat.Camt053
            : BankImportFormat.Camt054;

        // 3. Create BankImport entity
        var bankImport = BankImport.Create(request.FileName, request.UserName, format);

        // 4. Create BankImportItems from parsed entries
        foreach (var entry in parseResult.Entries)
        {
            var item = BankImportItem.Create(
                bankImport.Id,
                entry.BookingDate,
                entry.Description ?? entry.RemittanceInfo ?? "",
                entry.Amount,
                entry.DebtorIban ?? entry.CreditorIban,
                entry.CreditorReference ?? entry.EndToEndId);

            item.SetCamtFields(
                entry.EndToEndId,
                entry.CreditorReference,
                entry.RemittanceInfo,
                entry.DebtorName,
                entry.DebtorIban);

            bankImport.AddItem(item);
        }

        // 5. Run auto-matching
        var items = bankImport.Items.ToList();
        var suggestions = await _matcher.FindMatchesAsync(items, ct);

        foreach (var suggestion in suggestions)
        {
            var item = items.FirstOrDefault(i => i.Id == suggestion.BankImportItemId);
            item?.SetMatchSuggestion(suggestion.InvoiceId, suggestion.Confidence);
        }

        // 6. Persist
        await _repository.AddAsync(bankImport, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        // 7. Audit
        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Camt import '{bankImport.FileName}' ({format}) uploaded with {parseResult.Entries.Count} entries, {suggestions.Count} auto-matched",
            entityType: "BankImport",
            entityId: bankImport.Id.ToString(),
            ct: ct);

        return GetBankImportsQueryHandler.MapToDto(bankImport);
    }
}

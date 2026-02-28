using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Queries;

public sealed class GetBankImportsQueryHandler : IRequestHandler<GetBankImportsQuery, PagedResult<BankImportDto>>
{
    private readonly IBankImportRepository _repository;

    public GetBankImportsQueryHandler(IBankImportRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<BankImportDto>> Handle(GetBankImportsQuery request, CancellationToken ct)
    {
        var imports = await _repository.GetAllAsync(ct);
        var dtos = imports.Select(MapToDto);

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "importDate", true);
        var sorted = field.ToLowerInvariant() switch
        {
            "filename" => dtos.ApplySort(b => b.FileName, desc),
            _ => dtos.ApplySort(b => b.ImportDate, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }

    internal static BankImportDto MapToDto(BankImport bi) =>
        new(bi.Id, bi.ImportDate, bi.FileName, bi.Status.ToString(), bi.ImportedBy,
            bi.Format.ToString(), bi.Items.Select(MapItemDto).ToList());

    internal static BankImportItemDto MapItemDto(BankImportItem item) =>
        new(item.Id, item.TransactionDate, item.Description, item.Amount,
            item.Iban, item.Reference, item.Status.ToString(), item.MatchedPaymentId,
            item.EndToEndId, item.CreditorReference, item.RemittanceInfo,
            item.DebtorName, item.DebtorIban, item.SuggestedInvoiceId, item.MatchConfidence);
}

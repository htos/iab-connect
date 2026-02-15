using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Queries;

public sealed class GetBankImportsQueryHandler : IRequestHandler<GetBankImportsQuery, List<BankImportDto>>
{
    private readonly IBankImportRepository _repository;

    public GetBankImportsQueryHandler(IBankImportRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<BankImportDto>> Handle(GetBankImportsQuery request, CancellationToken ct)
    {
        var imports = await _repository.GetAllAsync(ct);
        return imports.Select(MapToDto).ToList();
    }

    internal static BankImportDto MapToDto(BankImport bi) =>
        new(bi.Id, bi.ImportDate, bi.FileName, bi.Status.ToString(), bi.ImportedBy,
            bi.Items.Select(MapItemDto).ToList());

    internal static BankImportItemDto MapItemDto(BankImportItem item) =>
        new(item.Id, item.TransactionDate, item.Description, item.Amount,
            item.Iban, item.Reference, item.Status.ToString(), item.MatchedPaymentId);
}

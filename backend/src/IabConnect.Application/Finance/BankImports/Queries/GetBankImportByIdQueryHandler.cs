using MediatR;

namespace IabConnect.Application.Finance.BankImports.Queries;

public sealed class GetBankImportByIdQueryHandler : IRequestHandler<GetBankImportByIdQuery, BankImportDto?>
{
    private readonly IBankImportRepository _repository;

    public GetBankImportByIdQueryHandler(IBankImportRepository repository)
    {
        _repository = repository;
    }

    public async Task<BankImportDto?> Handle(GetBankImportByIdQuery request, CancellationToken ct)
    {
        var bankImport = await _repository.GetByIdAsync(request.Id, ct);
        if (bankImport is null) return null;
        return GetBankImportsQueryHandler.MapToDto(bankImport);
    }
}

using IabConnect.Application.Finance.BankImports.Queries;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

/// <summary>
/// REQ-069: Command to import a camt.053 or camt.054 XML file.
/// </summary>
public sealed record ImportCamtCommand : IRequest<BankImportDto>
{
    public required string FileName { get; init; }
    public required Stream FileStream { get; init; }
    public required string UserName { get; init; }
}

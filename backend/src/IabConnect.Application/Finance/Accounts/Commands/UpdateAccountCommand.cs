using IabConnect.Application.Finance.Accounts.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Accounts.Commands;

/// <summary>
/// Command to update a financial account (REQ-038)
/// </summary>
public sealed record UpdateAccountCommand : IRequest<AccountDto?>
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required string Number { get; init; }
    public required string Type { get; init; }
    public string? Description { get; init; }
    public int SortOrder { get; init; }
    public required string UserName { get; init; }
}

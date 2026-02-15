using MediatR;

namespace IabConnect.Application.Finance.Accounts.Queries;

/// <summary>
/// Shared DTO for account data used by queries and commands
/// </summary>
public sealed record AccountDto(
    Guid Id, string Name, string Number, string Type, string? Description,
    bool IsActive, int SortOrder, DateTime CreatedAt, string CreatedBy,
    DateTime? UpdatedAt, string? UpdatedBy);

/// <summary>
/// Query to get all financial accounts (REQ-038)
/// </summary>
public sealed record GetAccountsQuery : IRequest<List<AccountDto>>;

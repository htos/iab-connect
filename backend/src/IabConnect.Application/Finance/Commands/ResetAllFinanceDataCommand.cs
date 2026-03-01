using MediatR;

namespace IabConnect.Application.Finance.Commands;

/// <summary>
/// Command to delete ALL finance data from the system.
/// This is an admin-only destructive operation that cannot be undone.
/// </summary>
public sealed record ResetAllFinanceDataCommand(string UserName) : IRequest<bool>;

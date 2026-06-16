using MediatR;

namespace IabConnect.Application.Finance.Budgets.Commands;

/// <summary>
/// REQ-044 (E6-S1): Soft-delete a budget. Frees the (area, period) pair for re-insert.
/// </summary>
public sealed record DeleteBudgetCommand(Guid Id, string UserName) : IRequest<bool>;

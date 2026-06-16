using MediatR;

namespace IabConnect.Application.Finance.Budgets.Queries;

/// <summary>
/// REQ-044 (E6-S1): Shared DTO for budget data used by queries and commands.
/// Enriched with the cost-center (ActivityArea) and fiscal-period descriptors for display.
/// </summary>
public sealed record BudgetDto(
    Guid Id,
    Guid ActivityAreaId,
    string? ActivityAreaName,
    string? ActivityAreaCode,
    Guid FiscalPeriodId,
    string? FiscalPeriodName,
    int? FiscalPeriodYear,
    int? FiscalPeriodMonth,
    decimal Amount,
    string Currency,
    string? Notes,
    DateTimeOffset CreatedAt,
    string? CreatedBy,
    DateTimeOffset? UpdatedAt,
    string? UpdatedBy);

/// <summary>
/// REQ-044 (E6-S1): Query to list budgets, optionally filtered by cost center, period, or year.
/// </summary>
public sealed record GetBudgetsQuery : IRequest<List<BudgetDto>>
{
    public Guid? ActivityAreaId { get; init; }
    public Guid? FiscalPeriodId { get; init; }
    public int? Year { get; init; }
}

/// <summary>
/// REQ-044 (E6-S1): Query to get a single budget by id.
/// </summary>
public sealed record GetBudgetByIdQuery(Guid Id) : IRequest<BudgetDto?>;

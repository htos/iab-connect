using MediatR;

namespace IabConnect.Application.Finance.Dashboard;

/// <summary>
/// DTO for the comprehensive finance dashboard overview.
/// </summary>
public sealed record FinanceDashboardResponse(
    // Transaction-based (existing)
    decimal TotalIncome,
    decimal TotalExpense,
    decimal Balance,

    // Invoice stats
    decimal InvoicesTotalOutstanding,
    int InvoicesOverdueCount,
    decimal InvoicesOverdueAmount,
    int InvoicesOpenCount,

    // Payment stats
    decimal PaymentsTotalPending,
    decimal PaymentsTotalPaid,
    int PaymentsPendingCount,

    // ExpenseClaim stats
    decimal ExpenseClaimsTotalPending,
    decimal ExpenseClaimsTotalReimbursed,
    int ExpenseClaimsPendingCount,

    // Period info
    string? CurrentFiscalPeriod,
    string? CurrentPeriodStatus
);

/// <summary>
/// Query to get the comprehensive finance dashboard data.
/// </summary>
public sealed record GetFinanceDashboardQuery : IRequest<FinanceDashboardResponse>;

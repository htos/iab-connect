using MediatR;

namespace IabConnect.Application.Reporting;

/// <summary>
/// REQ-050: Central dashboard overview aggregating Members, Events, and Finance KPIs.
/// </summary>
public sealed record GetDashboardOverviewQuery(
    DateTime? From,
    DateTime? To
) : IRequest<DashboardOverviewResponse>;

/// <summary>
/// Aggregated dashboard response for Vorstand, Kassier, and Event-Manager.
/// </summary>
public sealed record DashboardOverviewResponse(
    MemberKpis Members,
    EventKpis Events,
    FinanceKpis Finance
);

public sealed record MemberKpis(
    int TotalMembers,
    int ActiveMembers,
    int PendingMembers,
    int InactiveMembers,
    int SuspendedMembers,
    int NewMembersInPeriod,
    IReadOnlyList<MemberTrendItem> MonthlyTrend
);

public sealed record MemberTrendItem(
    string Month,
    int NewMembers,
    int TotalAtEndOfMonth
);

public sealed record EventKpis(
    int TotalEvents,
    int UpcomingEvents,
    int CompletedEvents,
    int CancelledEvents,
    int TotalRegistrations,
    int TotalParticipantsConfirmed,
    decimal TotalEventRevenue,
    IReadOnlyList<EventCategoryBreakdown> ByCategory
);

public sealed record EventCategoryBreakdown(
    string Category,
    int Count,
    int TotalRegistrations
);

public sealed record FinanceKpis(
    decimal TotalIncome,
    decimal TotalExpense,
    decimal Balance,
    decimal OutstandingInvoices,
    int OverdueInvoiceCount,
    decimal OverdueAmount,
    int OpenInvoiceCount,
    decimal PendingPayments,
    int PendingPaymentCount,
    decimal PendingExpenseClaims,
    int PendingExpenseClaimCount,
    string? CurrentFiscalPeriod,
    string? CurrentPeriodStatus
);

using IabConnect.Application.Finance;
using IabConnect.Domain.Events;
using IabConnect.Domain.Finance;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Reporting;

/// <summary>
/// REQ-050: Aggregates KPIs from Members, Events, and Finance for the central dashboard.
/// </summary>
public sealed class GetDashboardOverviewQueryHandler
    : IRequestHandler<GetDashboardOverviewQuery, DashboardOverviewResponse>
{
    private readonly IMemberRepository _memberRepository;
    private readonly IEventRepository _eventRepository;
    private readonly IEventRegistrationRepository _registrationRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IPaymentRepository _paymentRepository;
    private readonly IExpenseClaimRepository _expenseClaimRepository;
    private readonly IFiscalPeriodRepository _fiscalPeriodRepository;

    public GetDashboardOverviewQueryHandler(
        IMemberRepository memberRepository,
        IEventRepository eventRepository,
        IEventRegistrationRepository registrationRepository,
        ITransactionRepository transactionRepository,
        IInvoiceRepository invoiceRepository,
        IPaymentRepository paymentRepository,
        IExpenseClaimRepository expenseClaimRepository,
        IFiscalPeriodRepository fiscalPeriodRepository)
    {
        _memberRepository = memberRepository;
        _eventRepository = eventRepository;
        _registrationRepository = registrationRepository;
        _transactionRepository = transactionRepository;
        _invoiceRepository = invoiceRepository;
        _paymentRepository = paymentRepository;
        _expenseClaimRepository = expenseClaimRepository;
        _fiscalPeriodRepository = fiscalPeriodRepository;
    }

    public async Task<DashboardOverviewResponse> Handle(
        GetDashboardOverviewQuery request, CancellationToken ct)
    {
        var memberKpis = await BuildMemberKpis(request.From, request.To, ct);
        var eventKpis = await BuildEventKpis(request.From, request.To, ct);
        var financeKpis = await BuildFinanceKpis(request.From, request.To, ct);

        return new DashboardOverviewResponse(memberKpis, eventKpis, financeKpis);
    }

    private async Task<MemberKpis> BuildMemberKpis(DateTime? from, DateTime? to, CancellationToken ct)
    {
        var allMembers = await _memberRepository.GetAllAsync(ct);

        var activeMembers = allMembers.Count(m => m.Status == MembershipStatus.Active);
        var pendingMembers = allMembers.Count(m => m.Status == MembershipStatus.Pending);
        var inactiveMembers = allMembers.Count(m => m.Status == MembershipStatus.Inactive);
        var suspendedMembers = allMembers.Count(m => m.Status == MembershipStatus.Suspended);

        // Period filter for new members
        var periodFrom = DateOnly.FromDateTime(from ?? DateTime.UtcNow.AddMonths(-12));
        var periodTo = DateOnly.FromDateTime(to ?? DateTime.UtcNow);
        var newInPeriod = allMembers.Count(m => m.MemberSince >= periodFrom && m.MemberSince <= periodTo);

        // Monthly trend (last 12 months or within period)
        var trendStart = from ?? DateTime.UtcNow.AddMonths(-11);
        var trendEnd = to ?? DateTime.UtcNow;
        var monthlyTrend = BuildMonthlyMemberTrend(allMembers, trendStart, trendEnd);

        return new MemberKpis(
            TotalMembers: allMembers.Count,
            ActiveMembers: activeMembers,
            PendingMembers: pendingMembers,
            InactiveMembers: inactiveMembers,
            SuspendedMembers: suspendedMembers,
            NewMembersInPeriod: newInPeriod,
            MonthlyTrend: monthlyTrend
        );
    }

    private static List<MemberTrendItem> BuildMonthlyMemberTrend(
        IReadOnlyList<Member> allMembers, DateTime from, DateTime to)
    {
        var trend = new List<MemberTrendItem>();
        var current = new DateOnly(from.Year, from.Month, 1);
        var end = new DateOnly(to.Year, to.Month, 1);

        while (current <= end)
        {
            var monthEnd = current.AddMonths(1);
            var newInMonth = allMembers.Count(m =>
                m.MemberSince >= current && m.MemberSince < monthEnd);
            var totalAtEnd = allMembers.Count(m => m.MemberSince < monthEnd);

            trend.Add(new MemberTrendItem(
                Month: current.ToString("yyyy-MM"),
                NewMembers: newInMonth,
                TotalAtEndOfMonth: totalAtEnd
            ));

            current = monthEnd;
        }

        return trend;
    }

    private async Task<EventKpis> BuildEventKpis(DateTime? from, DateTime? to, CancellationToken ct)
    {
        var allEvents = await _eventRepository.GetAllAsync(ct);
        var now = DateTime.UtcNow;

        // Apply period filter if provided
        var filteredEvents = allEvents.AsEnumerable();
        if (from.HasValue)
            filteredEvents = filteredEvents.Where(e => e.StartDate >= from.Value);
        if (to.HasValue)
            filteredEvents = filteredEvents.Where(e => e.StartDate <= to.Value);
        var events = filteredEvents.ToList();

        var upcoming = events.Count(e => e.Status == EventStatus.Published && e.StartDate > now);
        var completed = events.Count(e => e.Status == EventStatus.Completed);
        var cancelled = events.Count(e => e.Status == EventStatus.Cancelled);

        // Aggregate registrations across all events
        var totalRegistrations = 0;
        var totalConfirmed = 0;
        var totalRevenue = 0m;

        foreach (var evt in events)
        {
            var stats = await _registrationRepository.GetStatisticsAsync(evt.Id, ct);
            totalRegistrations += stats.TotalRegistrations;
            totalConfirmed += stats.TotalParticipants;

            if (!evt.IsFree && evt.Cost.HasValue)
            {
                totalRevenue += evt.Cost.Value * stats.ConfirmedCount;
            }
        }

        // Category breakdown
        var byCategory = events
            .GroupBy(e => e.Category)
            .Select(g => new EventCategoryBreakdown(
                Category: g.Key.ToString(),
                Count: g.Count(),
                TotalRegistrations: 0 // Will be populated in a future iteration
            ))
            .OrderByDescending(c => c.Count)
            .ToList();

        return new EventKpis(
            TotalEvents: events.Count,
            UpcomingEvents: upcoming,
            CompletedEvents: completed,
            CancelledEvents: cancelled,
            TotalRegistrations: totalRegistrations,
            TotalParticipantsConfirmed: totalConfirmed,
            TotalEventRevenue: totalRevenue,
            ByCategory: byCategory
        );
    }

    private async Task<FinanceKpis> BuildFinanceKpis(DateTime? from, DateTime? to, CancellationToken ct)
    {
        var (totalIncome, totalExpense) = await _transactionRepository.GetSummaryAsync(from, to, ct);
        var balance = totalIncome - totalExpense;

        var openInvoices = await _invoiceRepository.GetOpenItemsAsync(ct);
        var overdueInvoices = openInvoices.Where(i => i.Status == InvoiceStatus.Overdue).ToList();

        var allPayments = await _paymentRepository.GetAllAsync(ct);
        var pendingPayments = allPayments
            .Where(p => p.Status != PaymentStatus.Paid && p.Status != PaymentStatus.Rejected)
            .ToList();

        var allClaims = await _expenseClaimRepository.GetAllAsync(ct: ct);
        var pendingClaims = allClaims
            .Where(e => e.Status != ExpenseClaimStatus.Reimbursed && e.Status != ExpenseClaimStatus.Rejected)
            .ToList();

        var now = DateTime.UtcNow;
        var currentPeriod = await _fiscalPeriodRepository.GetByDateAsync(now, ct);

        return new FinanceKpis(
            TotalIncome: totalIncome,
            TotalExpense: totalExpense,
            Balance: balance,
            OutstandingInvoices: openInvoices.Sum(i => i.Total),
            OverdueInvoiceCount: overdueInvoices.Count,
            OverdueAmount: overdueInvoices.Sum(i => i.Total),
            OpenInvoiceCount: openInvoices.Count,
            PendingPayments: pendingPayments.Sum(p => p.Amount),
            PendingPaymentCount: pendingPayments.Count,
            PendingExpenseClaims: pendingClaims.Sum(e => e.Amount),
            PendingExpenseClaimCount: pendingClaims.Count,
            CurrentFiscalPeriod: currentPeriod?.Name,
            CurrentPeriodStatus: currentPeriod?.Status.ToString()
        );
    }
}

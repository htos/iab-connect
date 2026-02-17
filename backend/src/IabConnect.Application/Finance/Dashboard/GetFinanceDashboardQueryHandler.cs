using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Dashboard;

public sealed class GetFinanceDashboardQueryHandler
    : IRequestHandler<GetFinanceDashboardQuery, FinanceDashboardResponse>
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IPaymentRepository _paymentRepository;
    private readonly IExpenseClaimRepository _expenseClaimRepository;
    private readonly IFiscalPeriodRepository _fiscalPeriodRepository;

    public GetFinanceDashboardQueryHandler(
        ITransactionRepository transactionRepository,
        IInvoiceRepository invoiceRepository,
        IPaymentRepository paymentRepository,
        IExpenseClaimRepository expenseClaimRepository,
        IFiscalPeriodRepository fiscalPeriodRepository)
    {
        _transactionRepository = transactionRepository;
        _invoiceRepository = invoiceRepository;
        _paymentRepository = paymentRepository;
        _expenseClaimRepository = expenseClaimRepository;
        _fiscalPeriodRepository = fiscalPeriodRepository;
    }

    public async Task<FinanceDashboardResponse> Handle(
        GetFinanceDashboardQuery request, CancellationToken ct)
    {
        // Transaction summary
        var (totalIncome, totalExpense) = await _transactionRepository.GetSummaryAsync(ct: ct);
        var balance = totalIncome - totalExpense;

        // Invoice stats – open items (Sent / Overdue)
        var openInvoices = await _invoiceRepository.GetOpenItemsAsync(ct);
        var invoicesOpenCount = openInvoices.Count;
        var invoicesTotalOutstanding = openInvoices.Sum(i => i.Total);
        var overdueInvoices = openInvoices.Where(i => i.Status == InvoiceStatus.Overdue).ToList();
        var invoicesOverdueCount = overdueInvoices.Count;
        var invoicesOverdueAmount = overdueInvoices.Sum(i => i.Total);

        // Payment stats
        var allPayments = await _paymentRepository.GetAllAsync(ct);
        var pendingPayments = allPayments
            .Where(p => p.Status != PaymentStatus.Paid && p.Status != PaymentStatus.Rejected)
            .ToList();
        var paidPayments = allPayments.Where(p => p.Status == PaymentStatus.Paid).ToList();
        var paymentsTotalPending = pendingPayments.Sum(p => p.Amount);
        var paymentsTotalPaid = paidPayments.Sum(p => p.Amount);
        var paymentsPendingCount = pendingPayments.Count;

        // ExpenseClaim stats
        var allClaims = await _expenseClaimRepository.GetAllAsync(ct: ct);
        var pendingClaims = allClaims
            .Where(e => e.Status != ExpenseClaimStatus.Reimbursed && e.Status != ExpenseClaimStatus.Rejected)
            .ToList();
        var reimbursedClaims = allClaims.Where(e => e.Status == ExpenseClaimStatus.Reimbursed).ToList();
        var expenseClaimsTotalPending = pendingClaims.Sum(e => e.Amount);
        var expenseClaimsTotalReimbursed = reimbursedClaims.Sum(e => e.Amount);
        var expenseClaimsPendingCount = pendingClaims.Count;

        // Current fiscal period
        var now = DateTime.UtcNow;
        var currentPeriod = await _fiscalPeriodRepository.GetByDateAsync(now, ct);
        var currentFiscalPeriod = currentPeriod?.Name;
        var currentPeriodStatus = currentPeriod?.Status.ToString();

        return new FinanceDashboardResponse(
            TotalIncome: totalIncome,
            TotalExpense: totalExpense,
            Balance: balance,
            InvoicesTotalOutstanding: invoicesTotalOutstanding,
            InvoicesOverdueCount: invoicesOverdueCount,
            InvoicesOverdueAmount: invoicesOverdueAmount,
            InvoicesOpenCount: invoicesOpenCount,
            PaymentsTotalPending: paymentsTotalPending,
            PaymentsTotalPaid: paymentsTotalPaid,
            PaymentsPendingCount: paymentsPendingCount,
            ExpenseClaimsTotalPending: expenseClaimsTotalPending,
            ExpenseClaimsTotalReimbursed: expenseClaimsTotalReimbursed,
            ExpenseClaimsPendingCount: expenseClaimsPendingCount,
            CurrentFiscalPeriod: currentFiscalPeriod,
            CurrentPeriodStatus: currentPeriodStatus
        );
    }
}

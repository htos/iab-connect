using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Accounting.Reports;

// ─── DTOs ───

public sealed record TrialBalanceLineDto(
    Guid LedgerAccountId,
    string AccountNumber,
    string AccountName,
    string AccountClass,
    decimal TotalDebit,
    decimal TotalCredit,
    decimal Balance);

public sealed record TrialBalanceReportDto(
    DateTime? From,
    DateTime? To,
    List<TrialBalanceLineDto> Lines,
    decimal TotalDebit,
    decimal TotalCredit);

public sealed record BalanceSheetLineDto(
    Guid LedgerAccountId,
    string AccountNumber,
    string AccountName,
    string AccountClass,
    decimal Balance);

public sealed record BalanceSheetReportDto(
    DateTime AsOfDate,
    List<BalanceSheetLineDto> Assets,
    List<BalanceSheetLineDto> Liabilities,
    List<BalanceSheetLineDto> Equity,
    decimal TotalAssets,
    decimal TotalLiabilities,
    decimal TotalEquity);

public sealed record ProfitAndLossLineDto(
    Guid LedgerAccountId,
    string AccountNumber,
    string AccountName,
    decimal Amount);

public sealed record ProfitAndLossReportDto(
    DateTime? From,
    DateTime? To,
    List<ProfitAndLossLineDto> Revenue,
    List<ProfitAndLossLineDto> Expenses,
    decimal TotalRevenue,
    decimal TotalExpenses,
    decimal NetResult);

// ─── Trial Balance Query ───

public sealed record GetTrialBalanceQuery : IRequest<TrialBalanceReportDto>
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
}

public sealed class GetTrialBalanceQueryHandler : IRequestHandler<GetTrialBalanceQuery, TrialBalanceReportDto>
{
    private readonly IJournalEntryRepository _journalRepo;
    private readonly ILedgerAccountRepository _accountRepo;
    private readonly IFinanceProfileRepository _profileRepo;

    public GetTrialBalanceQueryHandler(
        IJournalEntryRepository journalRepo,
        ILedgerAccountRepository accountRepo,
        IFinanceProfileRepository profileRepo)
    {
        _journalRepo = journalRepo;
        _accountRepo = accountRepo;
        _profileRepo = profileRepo;
    }

    public async Task<TrialBalanceReportDto> Handle(GetTrialBalanceQuery request, CancellationToken ct)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct)
            ?? throw new InvalidOperationException("No active finance profile found.");

        var entries = await _journalRepo.GetAllAsync(
            profile.Id, request.From, request.To, JournalEntryStatus.Posted, ct);

        var accounts = await _accountRepo.GetAllByProfileAsync(profile.Id, ct);
        var accountDict = accounts.ToDictionary(a => a.Id);

        // Aggregate debit/credit per account
        var accountTotals = new Dictionary<Guid, (decimal Debit, decimal Credit)>();
        foreach (var entry in entries)
        {
            foreach (var line in entry.Lines)
            {
                if (!accountTotals.ContainsKey(line.LedgerAccountId))
                    accountTotals[line.LedgerAccountId] = (0, 0);

                var current = accountTotals[line.LedgerAccountId];
                accountTotals[line.LedgerAccountId] = (current.Debit + line.DebitAmount, current.Credit + line.CreditAmount);
            }
        }

        var lines = accountTotals
            .Where(kvp => accountDict.ContainsKey(kvp.Key))
            .Select(kvp =>
            {
                var account = accountDict[kvp.Key];
                var balance = kvp.Value.Debit - kvp.Value.Credit;
                return new TrialBalanceLineDto(
                    kvp.Key, account.Number, account.Name,
                    account.AccountClass.ToString(),
                    kvp.Value.Debit, kvp.Value.Credit, balance);
            })
            .OrderBy(l => l.AccountNumber)
            .ToList();

        return new TrialBalanceReportDto(
            request.From, request.To, lines,
            lines.Sum(l => l.TotalDebit),
            lines.Sum(l => l.TotalCredit));
    }
}

// ─── Balance Sheet Query ───

public sealed record GetBalanceSheetQuery : IRequest<BalanceSheetReportDto>
{
    public DateTime? AsOfDate { get; init; }
}

public sealed class GetBalanceSheetQueryHandler : IRequestHandler<GetBalanceSheetQuery, BalanceSheetReportDto>
{
    private readonly IJournalEntryRepository _journalRepo;
    private readonly ILedgerAccountRepository _accountRepo;
    private readonly IFinanceProfileRepository _profileRepo;

    public GetBalanceSheetQueryHandler(
        IJournalEntryRepository journalRepo,
        ILedgerAccountRepository accountRepo,
        IFinanceProfileRepository profileRepo)
    {
        _journalRepo = journalRepo;
        _accountRepo = accountRepo;
        _profileRepo = profileRepo;
    }

    public async Task<BalanceSheetReportDto> Handle(GetBalanceSheetQuery request, CancellationToken ct)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct)
            ?? throw new InvalidOperationException("No active finance profile found.");

        var asOfDate = request.AsOfDate.HasValue
            ? DateTime.SpecifyKind(request.AsOfDate.Value, DateTimeKind.Utc)
            : DateTime.UtcNow.Date;
        var entries = await _journalRepo.GetAllAsync(
            profile.Id, null, asOfDate, JournalEntryStatus.Posted, ct);

        var accounts = await _accountRepo.GetAllByProfileAsync(profile.Id, ct);
        var accountDict = accounts.ToDictionary(a => a.Id);

        var accountBalances = CalculateBalances(entries, accountDict);

        var assets = accountBalances
            .Where(b => b.AccountClass == LedgerAccountClass.Asset.ToString())
            .Select(b => new BalanceSheetLineDto(b.LedgerAccountId, b.AccountNumber, b.AccountName, b.AccountClass, b.Balance))
            .OrderBy(l => l.AccountNumber)
            .ToList();

        var liabilities = accountBalances
            .Where(b => b.AccountClass == LedgerAccountClass.Liability.ToString())
            .Select(b => new BalanceSheetLineDto(b.LedgerAccountId, b.AccountNumber, b.AccountName, b.AccountClass, b.Balance))
            .OrderBy(l => l.AccountNumber)
            .ToList();

        var equity = accountBalances
            .Where(b => b.AccountClass == LedgerAccountClass.Equity.ToString())
            .Select(b => new BalanceSheetLineDto(b.LedgerAccountId, b.AccountNumber, b.AccountName, b.AccountClass, b.Balance))
            .OrderBy(l => l.AccountNumber)
            .ToList();

        return new BalanceSheetReportDto(
            asOfDate, assets, liabilities, equity,
            assets.Sum(a => a.Balance),
            liabilities.Sum(l => l.Balance),
            equity.Sum(e => e.Balance));
    }

    private static List<TrialBalanceLineDto> CalculateBalances(
        List<JournalEntry> entries, Dictionary<Guid, LedgerAccount> accountDict)
    {
        var accountTotals = new Dictionary<Guid, (decimal Debit, decimal Credit)>();
        foreach (var entry in entries)
        {
            foreach (var line in entry.Lines)
            {
                if (!accountTotals.ContainsKey(line.LedgerAccountId))
                    accountTotals[line.LedgerAccountId] = (0, 0);

                var current = accountTotals[line.LedgerAccountId];
                accountTotals[line.LedgerAccountId] = (current.Debit + line.DebitAmount, current.Credit + line.CreditAmount);
            }
        }

        return accountTotals
            .Where(kvp => accountDict.ContainsKey(kvp.Key))
            .Select(kvp =>
            {
                var account = accountDict[kvp.Key];
                // Balance sign depends on normal balance: Debit accounts = Debit - Credit, Credit accounts = Credit - Debit
                var balance = account.NormalBalance == NormalBalance.Debit
                    ? kvp.Value.Debit - kvp.Value.Credit
                    : kvp.Value.Credit - kvp.Value.Debit;
                return new TrialBalanceLineDto(
                    kvp.Key, account.Number, account.Name,
                    account.AccountClass.ToString(),
                    kvp.Value.Debit, kvp.Value.Credit, balance);
            })
            .ToList();
    }
}

// ─── Profit & Loss Query ───

public sealed record GetProfitAndLossQuery : IRequest<ProfitAndLossReportDto>
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
}

public sealed class GetProfitAndLossQueryHandler : IRequestHandler<GetProfitAndLossQuery, ProfitAndLossReportDto>
{
    private readonly IJournalEntryRepository _journalRepo;
    private readonly ILedgerAccountRepository _accountRepo;
    private readonly IFinanceProfileRepository _profileRepo;

    public GetProfitAndLossQueryHandler(
        IJournalEntryRepository journalRepo,
        ILedgerAccountRepository accountRepo,
        IFinanceProfileRepository profileRepo)
    {
        _journalRepo = journalRepo;
        _accountRepo = accountRepo;
        _profileRepo = profileRepo;
    }

    public async Task<ProfitAndLossReportDto> Handle(GetProfitAndLossQuery request, CancellationToken ct)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct)
            ?? throw new InvalidOperationException("No active finance profile found.");

        var entries = await _journalRepo.GetAllAsync(
            profile.Id, request.From, request.To, JournalEntryStatus.Posted, ct);

        var accounts = await _accountRepo.GetAllByProfileAsync(profile.Id, ct);
        var accountDict = accounts.ToDictionary(a => a.Id);

        var accountTotals = new Dictionary<Guid, (decimal Debit, decimal Credit)>();
        foreach (var entry in entries)
        {
            foreach (var line in entry.Lines)
            {
                if (!accountTotals.ContainsKey(line.LedgerAccountId))
                    accountTotals[line.LedgerAccountId] = (0, 0);

                var current = accountTotals[line.LedgerAccountId];
                accountTotals[line.LedgerAccountId] = (current.Debit + line.DebitAmount, current.Credit + line.CreditAmount);
            }
        }

        var revenue = accountTotals
            .Where(kvp => accountDict.ContainsKey(kvp.Key) && accountDict[kvp.Key].AccountClass == LedgerAccountClass.Revenue)
            .Select(kvp =>
            {
                var account = accountDict[kvp.Key];
                // Revenue: Credit - Debit
                var amount = kvp.Value.Credit - kvp.Value.Debit;
                return new ProfitAndLossLineDto(kvp.Key, account.Number, account.Name, amount);
            })
            .OrderBy(l => l.AccountNumber)
            .ToList();

        var expenses = accountTotals
            .Where(kvp => accountDict.ContainsKey(kvp.Key) && accountDict[kvp.Key].AccountClass == LedgerAccountClass.Expense)
            .Select(kvp =>
            {
                var account = accountDict[kvp.Key];
                // Expenses: Debit - Credit
                var amount = kvp.Value.Debit - kvp.Value.Credit;
                return new ProfitAndLossLineDto(kvp.Key, account.Number, account.Name, amount);
            })
            .OrderBy(l => l.AccountNumber)
            .ToList();

        var totalRevenue = revenue.Sum(r => r.Amount);
        var totalExpenses = expenses.Sum(e => e.Amount);

        return new ProfitAndLossReportDto(
            request.From, request.To, revenue, expenses,
            totalRevenue, totalExpenses, totalRevenue - totalExpenses);
    }
}

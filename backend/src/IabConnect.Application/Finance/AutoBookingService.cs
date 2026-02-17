using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance;

/// <summary>
/// Creates general-ledger transactions automatically when financial events occur.
/// Uses the first active account (by SortOrder) as the booking account.
/// </summary>
public sealed class AutoBookingService : IAutoBookingService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;

    public AutoBookingService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
    }

    public async Task<Transaction> CreateTransactionForPaymentAsync(
        Payment payment, string userName, CancellationToken ct = default)
    {
        var accountId = await ResolveDefaultAccountIdAsync(ct);

        // Use the explicit direction set on the payment
        var txType = payment.Direction == PaymentDirection.Income
            ? TransactionType.Income
            : TransactionType.Expense;

        var description = payment.Direction == PaymentDirection.Income
            ? $"Payment received ({payment.Direction}) – Payment {payment.Id}"
            : $"Payment recorded ({payment.Direction}) – Payment {payment.Id}";

        var transaction = Transaction.Create(
            payment.Date,
            description,
            payment.Amount,
            txType,
            accountId,
            categoryId: null,
            reference: payment.Reference,
            notes: $"Auto-generated from payment {payment.Id}",
            createdBy: userName);

        await _transactionRepository.AddAsync(transaction, ct);

        payment.LinkTransaction(transaction.Id);

        return transaction;
    }

    public async Task<Transaction> CreateTransactionForExpenseClaimAsync(
        ExpenseClaim claim, Payment payment, string userName, CancellationToken ct = default)
    {
        var accountId = await ResolveDefaultAccountIdAsync(ct);

        var transaction = Transaction.Create(
            payment.Date,
            $"Expense reimbursement: {claim.Title} – Claim {claim.Id}",
            claim.Amount,
            TransactionType.Expense,
            accountId,
            categoryId: null,
            reference: payment.Reference,
            notes: $"Auto-generated from expense claim {claim.Id}",
            createdBy: userName);

        await _transactionRepository.AddAsync(transaction, ct);

        payment.LinkTransaction(transaction.Id);

        return transaction;
    }

    private async Task<Guid> ResolveDefaultAccountIdAsync(CancellationToken ct)
    {
        var accounts = await _accountRepository.GetAllAsync(ct);
        var activeAccount = accounts
            .Where(a => a.IsActive)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .FirstOrDefault();

        return activeAccount?.Id
            ?? throw new InvalidOperationException(
                "No active account found. Please create at least one active account before recording payments.");
    }
}

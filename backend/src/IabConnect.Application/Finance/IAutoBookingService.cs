using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance;

/// <summary>
/// Service for automatically creating general-ledger transactions (bookings)
/// when financial events occur (e.g. payment marked as paid, expense claim reimbursed).
/// </summary>
public interface IAutoBookingService
{
    /// <summary>
    /// Creates a Transaction for a payment that has been marked as paid.
    /// Uses the payment's Direction (Income/Expense) to determine the transaction type.
    /// The payment's TransactionId is set to the new transaction.
    /// </summary>
    Task<Transaction> CreateTransactionForPaymentAsync(Payment payment, string userName, CancellationToken ct = default);

    /// <summary>
    /// Creates an Expense transaction for a reimbursed expense claim.
    /// The payment's TransactionId is set to the new transaction.
    /// </summary>
    Task<Transaction> CreateTransactionForExpenseClaimAsync(ExpenseClaim claim, Payment payment, string userName, CancellationToken ct = default);
}

using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-067: Expense claim submitted by a member for reimbursement.
/// Follows approval workflow: Draft -> Submitted -> UnderReview -> Approved -> Reimbursed
/// </summary>
public class ExpenseClaim : Entity, ISoftDeletable
{
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }
    public FinanceCurrency Currency { get; private set; }
    public DateTime Date { get; private set; }
    public ExpenseClaimStatus Status { get; private set; } = ExpenseClaimStatus.Draft;

    // Claimant
    public Guid ClaimantId { get; private set; }
    public string ClaimantName { get; private set; } = string.Empty;

    // Receipt reference
    public Guid? ReceiptId { get; private set; }
    public Receipt? Receipt { get; private set; }

    // Review (Kassier)
    public string? ReviewedBy { get; private set; }
    public DateTime? ReviewedAt { get; private set; }
    public string? ReviewComment { get; private set; }

    // Approval (Vorstand)
    public string? ApprovedBy { get; private set; }
    public DateTime? ApprovedAt { get; private set; }
    public string? ApprovalComment { get; private set; }

    // Rejection
    public string? RejectedBy { get; private set; }
    public DateTime? RejectedAt { get; private set; }
    public string? RejectionReason { get; private set; }

    // Reimbursement
    public Guid? PaymentId { get; private set; }
    public Payment? Payment { get; private set; }
    public DateTime? ReimbursedAt { get; private set; }
    public string? ReimbursedBy { get; private set; }

    // Tracking
    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTime? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    private ExpenseClaim() { }

    public static ExpenseClaim Create(
        string title, string description, decimal amount, FinanceCurrency currency,
        DateTime date, Guid claimantId, string claimantName, Guid? receiptId, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required.", nameof(description));
        if (amount <= 0)
            throw new ArgumentException("Amount must be positive.", nameof(amount));
        if (string.IsNullOrWhiteSpace(claimantName))
            throw new ArgumentException("Claimant name is required.", nameof(claimantName));

        return new ExpenseClaim
        {
            Title = title.Trim(),
            Description = description.Trim(),
            Amount = amount,
            Currency = currency,
            Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
            ClaimantId = claimantId,
            ClaimantName = claimantName.Trim(),
            ReceiptId = receiptId,
            Status = ExpenseClaimStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(
        string title, string description, decimal amount, DateTime date,
        Guid? receiptId, string updatedBy)
    {
        if (Status != ExpenseClaimStatus.Draft)
            throw new InvalidOperationException("Only draft claims can be updated.");

        Title = title.Trim();
        Description = description.Trim();
        Amount = amount;
        Date = DateTime.SpecifyKind(date, DateTimeKind.Utc);
        ReceiptId = receiptId;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void Submit(string submittedBy)
    {
        if (Status != ExpenseClaimStatus.Draft)
            throw new InvalidOperationException("Only draft claims can be submitted.");
        Status = ExpenseClaimStatus.Submitted;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = submittedBy;
    }

    public void Review(string reviewedBy, string? comment = null)
    {
        if (Status != ExpenseClaimStatus.Submitted)
            throw new InvalidOperationException("Only submitted claims can be reviewed.");
        Status = ExpenseClaimStatus.UnderReview;
        ReviewedBy = reviewedBy;
        ReviewedAt = DateTime.UtcNow;
        ReviewComment = comment?.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = reviewedBy;
    }

    public void Approve(string approvedBy, string? comment = null)
    {
        if (Status != ExpenseClaimStatus.UnderReview)
            throw new InvalidOperationException("Only claims under review can be approved.");
        Status = ExpenseClaimStatus.Approved;
        ApprovedBy = approvedBy;
        ApprovedAt = DateTime.UtcNow;
        ApprovalComment = comment?.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = approvedBy;
    }

    public void Reject(string rejectedBy, string reason)
    {
        if (Status != ExpenseClaimStatus.Submitted && Status != ExpenseClaimStatus.UnderReview)
            throw new InvalidOperationException("Only submitted or reviewed claims can be rejected.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Rejection reason is required.", nameof(reason));
        Status = ExpenseClaimStatus.Rejected;
        RejectedBy = rejectedBy;
        RejectedAt = DateTime.UtcNow;
        RejectionReason = reason.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = rejectedBy;
    }

    public void Reimburse(Guid paymentId, string reimbursedBy)
    {
        if (Status != ExpenseClaimStatus.Approved)
            throw new InvalidOperationException("Only approved claims can be reimbursed.");
        Status = ExpenseClaimStatus.Reimbursed;
        PaymentId = paymentId;
        ReimbursedAt = DateTime.UtcNow;
        ReimbursedBy = reimbursedBy;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = reimbursedBy;
    }

    public void ResetToDraft(string updatedBy)
    {
        if (Status != ExpenseClaimStatus.Rejected)
            throw new InvalidOperationException("Only rejected claims can be reset to draft.");
        Status = ExpenseClaimStatus.Draft;
        RejectedBy = null;
        RejectedAt = null;
        RejectionReason = null;
        ReviewedBy = null;
        ReviewedAt = null;
        ReviewComment = null;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void SoftDelete(string? deletedBy = null)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = deletedBy;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }
}

namespace IabConnect.Application.Finance.ExpenseClaims;

/// <summary>
/// REQ-067: DTO for ExpenseClaim entity
/// </summary>
public sealed record ExpenseClaimDto(
    Guid Id,
    string Title,
    string Description,
    decimal Amount,
    string Currency,
    DateTime Date,
    string Status,
    Guid ClaimantId,
    string ClaimantName,
    Guid? ReceiptId,
    string? ReviewedBy,
    DateTime? ReviewedAt,
    string? ReviewComment,
    string? ApprovedBy,
    DateTime? ApprovedAt,
    string? ApprovalComment,
    string? RejectedBy,
    DateTime? RejectedAt,
    string? RejectionReason,
    Guid? PaymentId,
    DateTime? ReimbursedAt,
    string? ReimbursedBy,
    DateTime CreatedAt,
    string CreatedBy);

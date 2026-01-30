namespace IabConnect.Domain.Privacy;

/// <summary>
/// Status of a data deletion request (REQ-012: DSGVO)
/// </summary>
public enum DeletionRequestStatus
{
    /// <summary>
    /// Request submitted, awaiting confirmation period
    /// </summary>
    Pending = 0,

    /// <summary>
    /// User confirmed the deletion request
    /// </summary>
    Confirmed = 1,

    /// <summary>
    /// Admin is reviewing (e.g., open balances)
    /// </summary>
    UnderReview = 2,

    /// <summary>
    /// Deletion has been completed
    /// </summary>
    Completed = 3,

    /// <summary>
    /// Request was cancelled by user
    /// </summary>
    Cancelled = 4,

    /// <summary>
    /// Request was rejected (with reason)
    /// </summary>
    Rejected = 5
}

/// <summary>
/// Request for data deletion/account removal (REQ-012: DSGVO - Right to be forgotten)
/// </summary>
public class DeletionRequest
{
    public Guid Id { get; private set; }

    /// <summary>
    /// The user requesting deletion
    /// </summary>
    public Guid UserId { get; private set; }

    /// <summary>
    /// Email at time of request (for notifications)
    /// </summary>
    public string Email { get; private set; } = string.Empty;

    /// <summary>
    /// Current status of the request
    /// </summary>
    public DeletionRequestStatus Status { get; private set; }

    /// <summary>
    /// When the request was created
    /// </summary>
    public DateTime RequestedAt { get; private set; }

    /// <summary>
    /// When the request was confirmed by user
    /// </summary>
    public DateTime? ConfirmedAt { get; private set; }

    /// <summary>
    /// When the deletion was completed
    /// </summary>
    public DateTime? CompletedAt { get; private set; }

    /// <summary>
    /// Confirmation token sent via email
    /// </summary>
    public string? ConfirmationToken { get; private set; }

    /// <summary>
    /// Token expiration time
    /// </summary>
    public DateTime? TokenExpiresAt { get; private set; }

    /// <summary>
    /// Optional reason provided by user
    /// </summary>
    public string? Reason { get; private set; }

    /// <summary>
    /// Admin notes (e.g., rejection reason)
    /// </summary>
    public string? AdminNotes { get; private set; }

    /// <summary>
    /// IP address at time of request
    /// </summary>
    public string? IpAddress { get; private set; }

    private DeletionRequest() { } // EF Core

    public static DeletionRequest Create(
        Guid userId,
        string email,
        string? reason = null,
        string? ipAddress = null)
    {
        var token = Convert.ToBase64String(Guid.NewGuid().ToByteArray())
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');

        return new DeletionRequest
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Email = email,
            Status = DeletionRequestStatus.Pending,
            RequestedAt = DateTime.UtcNow,
            ConfirmationToken = token,
            TokenExpiresAt = DateTime.UtcNow.AddDays(7),
            Reason = reason,
            IpAddress = ipAddress
        };
    }

    public bool Confirm(string token)
    {
        if (Status != DeletionRequestStatus.Pending)
            return false;

        if (ConfirmationToken != token)
            return false;

        if (TokenExpiresAt.HasValue && DateTime.UtcNow > TokenExpiresAt.Value)
            return false;

        Status = DeletionRequestStatus.Confirmed;
        ConfirmedAt = DateTime.UtcNow;
        ConfirmationToken = null; // Clear token after use
        return true;
    }

    public void SetUnderReview(string? adminNotes = null)
    {
        Status = DeletionRequestStatus.UnderReview;
        AdminNotes = adminNotes;
    }

    public void Complete()
    {
        Status = DeletionRequestStatus.Completed;
        CompletedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        if (Status == DeletionRequestStatus.Completed)
            return;

        Status = DeletionRequestStatus.Cancelled;
    }

    public void Reject(string reason)
    {
        Status = DeletionRequestStatus.Rejected;
        AdminNotes = reason;
    }
}

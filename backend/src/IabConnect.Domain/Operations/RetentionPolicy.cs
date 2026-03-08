namespace IabConnect.Domain.Operations;

/// <summary>
/// REQ-057: Configurable retention policy per data category.
/// Defines how long data is retained and what action to take when expired.
/// </summary>
public class RetentionPolicy
{
    public Guid Id { get; private set; }
    public string DataCategory { get; private set; } = null!;
    public string DisplayName { get; private set; } = null!;
    public int RetentionMonths { get; private set; }
    public RetentionAction Action { get; private set; }
    public string? LegalBasis { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private RetentionPolicy() { }

    public static RetentionPolicy Create(
        string dataCategory,
        string displayName,
        int retentionMonths,
        RetentionAction action,
        string? legalBasis = null)
    {
        if (retentionMonths < 1)
            throw new ArgumentException("Retention period must be at least 1 month.", nameof(retentionMonths));

        return new RetentionPolicy
        {
            Id = Guid.NewGuid(),
            DataCategory = dataCategory,
            DisplayName = displayName,
            RetentionMonths = retentionMonths,
            Action = action,
            LegalBasis = legalBasis,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Update(string displayName, int retentionMonths, RetentionAction action, string? legalBasis)
    {
        if (retentionMonths < 1)
            throw new ArgumentException("Retention period must be at least 1 month.", nameof(retentionMonths));

        DisplayName = displayName;
        RetentionMonths = retentionMonths;
        Action = action;
        LegalBasis = legalBasis;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }
}

/// <summary>
/// Action to perform when a retention period expires.
/// </summary>
public enum RetentionAction
{
    /// <summary>Replace PII with anonymized values (DSGVO Art. 17).</summary>
    Anonymize,

    /// <summary>Mark as archived / read-only (Swiss OR Art. 958f).</summary>
    Archive,

    /// <summary>Permanently delete the record and associated files.</summary>
    Delete
}

/// <summary>
/// Well-known data categories for retention policies.
/// </summary>
public static class DataCategories
{
    public const string AuditLogs = "audit_logs";
    public const string MemberData = "member_data";
    public const string FinanceData = "finance_data";
    public const string Documents = "documents";
    public const string Backups = "backups";
    public const string Events = "events";
}

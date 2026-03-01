using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-075: Chart of accounts entry for double-entry bookkeeping.
/// Separated from existing Account entity which tracks cash/bank accounts.
/// </summary>
public class LedgerAccount : Entity, ISoftDeletable
{
    public string Number { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public LedgerAccountClass AccountClass { get; private set; }
    public NormalBalance NormalBalance { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; } = true;
    public Guid? ParentAccountId { get; private set; }
    public Guid FinanceProfileId { get; private set; }
    public int SortOrder { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTime? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    // Navigation
    public LedgerAccount? ParentAccount { get; private set; }
    public FinanceProfile? FinanceProfile { get; private set; }

    private LedgerAccount() { }

    public static LedgerAccount Create(
        string number,
        string name,
        LedgerAccountClass accountClass,
        NormalBalance normalBalance,
        Guid financeProfileId,
        string createdBy,
        string? description = null,
        Guid? parentAccountId = null,
        int sortOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(number))
            throw new ArgumentException("Account number is required.", nameof(number));
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Account name is required.", nameof(name));

        return new LedgerAccount
        {
            Number = number.Trim(),
            Name = name.Trim(),
            AccountClass = accountClass,
            NormalBalance = normalBalance,
            FinanceProfileId = financeProfileId,
            Description = description?.Trim(),
            ParentAccountId = parentAccountId,
            SortOrder = sortOrder,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(
        string number,
        string name,
        LedgerAccountClass accountClass,
        NormalBalance normalBalance,
        string updatedBy,
        string? description = null,
        Guid? parentAccountId = null,
        int sortOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(number))
            throw new ArgumentException("Account number is required.", nameof(number));
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Account name is required.", nameof(name));

        Number = number.Trim();
        Name = name.Trim();
        AccountClass = accountClass;
        NormalBalance = normalBalance;
        Description = description?.Trim();
        ParentAccountId = parentAccountId;
        SortOrder = sortOrder;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

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

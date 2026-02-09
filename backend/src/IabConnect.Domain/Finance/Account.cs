using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-038: Financial account (Konto) for categorizing transactions.
/// </summary>
public class Account : Entity
{
    public string Name { get; private set; } = string.Empty;
    public string Number { get; private set; } = string.Empty;
    public AccountType Type { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; } = true;
    public int SortOrder { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTime? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }

    private Account() { }

    public static Account Create(
        string name,
        string number,
        AccountType type,
        string? description,
        int sortOrder,
        string createdBy)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Account name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(number))
            throw new ArgumentException("Account number is required.", nameof(number));

        return new Account
        {
            Name = name.Trim(),
            Number = number.Trim(),
            Type = type,
            Description = description?.Trim(),
            SortOrder = sortOrder,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(string name, string number, AccountType type, string? description, int sortOrder, string updatedBy)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Account name is required.", nameof(name));

        Name = name.Trim();
        Number = number.Trim();
        Type = type;
        Description = description?.Trim();
        SortOrder = sortOrder;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}

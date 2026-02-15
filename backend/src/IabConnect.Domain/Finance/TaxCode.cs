using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-062: Configurable tax code (MWST/VAT rate).
/// </summary>
public class TaxCode : Entity, ISoftDeletable
{
    public string Code { get; private set; } = string.Empty;
    public string Label { get; private set; } = string.Empty;
    public decimal Rate { get; private set; }
    public bool IsDefault { get; private set; }
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }

    private TaxCode() { }

    public static TaxCode Create(string code, string label, decimal rate, bool isDefault = false)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(label))
            throw new ArgumentException("Label is required.", nameof(label));
        if (rate < 0 || rate > 1)
            throw new ArgumentOutOfRangeException(nameof(rate), "Rate must be between 0 and 1.");

        return new TaxCode
        {
            Code = code.Trim().ToUpperInvariant(),
            Label = label.Trim(),
            Rate = rate,
            IsDefault = isDefault,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Update(string code, string label, decimal rate, bool isDefault, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(label))
            throw new ArgumentException("Label is required.", nameof(label));
        if (rate < 0 || rate > 1)
            throw new ArgumentOutOfRangeException(nameof(rate), "Rate must be between 0 and 1.");

        Code = code.Trim().ToUpperInvariant();
        Label = label.Trim();
        Rate = rate;
        IsDefault = isDefault;
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SoftDelete()
    {
        IsDeleted = true;
        IsActive = false;
        DeletedAt = DateTime.UtcNow;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
    }
}

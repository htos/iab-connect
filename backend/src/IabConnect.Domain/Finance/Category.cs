using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-038: Transaction category for income/expense classification.
/// </summary>
public class Category : Entity
{
    public string Name { get; private set; } = string.Empty;
    public TransactionType Type { get; private set; }
    public string Color { get; private set; } = "#6b7280";
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;

    private Category() { }

    public static Category Create(string name, TransactionType type, string color, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Category name is required.", nameof(name));

        return new Category
        {
            Name = name.Trim(),
            Type = type,
            Color = color,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(string name, TransactionType type, string color)
    {
        Name = name.Trim();
        Type = type;
        Color = color;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}

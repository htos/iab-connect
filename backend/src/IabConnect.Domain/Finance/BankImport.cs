using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-041: Bank import batch (CSV file import session).
/// </summary>
public class BankImport : Entity, ISoftDeletable
{
    public DateTime ImportDate { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public BankImportStatus Status { get; private set; } = BankImportStatus.Pending;
    public string ImportedBy { get; private set; } = string.Empty;
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    private readonly List<BankImportItem> _items = [];
    public IReadOnlyList<BankImportItem> Items => _items.AsReadOnly();

    private BankImport() { }

    public static BankImport Create(string fileName, string importedBy)
    {
        return new BankImport
        {
            ImportDate = DateTime.UtcNow,
            FileName = fileName,
            ImportedBy = importedBy
        };
    }

    public void AddItem(BankImportItem item) => _items.Add(item);

    public void MarkAsProcessed()
    {
        Status = BankImportStatus.Processed;
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

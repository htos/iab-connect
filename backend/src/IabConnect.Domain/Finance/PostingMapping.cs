using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-077/082: Mapping between subledger entities (Category, Account, TaxCode)
/// and general ledger accounts for automatic journal entry creation.
/// </summary>
public class PostingMapping : Entity
{
    public Guid FinanceProfileId { get; private set; }
    public PostingMappingType MappingType { get; private set; }

    /// <summary>
    /// The ID of the source entity (Category.Id, Account.Id, or TaxCode.Id)
    /// </summary>
    public Guid SourceId { get; private set; }

    /// <summary>
    /// The target ledger account for the main posting
    /// </summary>
    public Guid LedgerAccountId { get; private set; }

    /// <summary>
    /// For TaxCode mappings: the ledger account for tax (e.g., input tax or output tax)
    /// </summary>
    public Guid? TaxLedgerAccountId { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTime? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }

    // Navigation
    public FinanceProfile? FinanceProfile { get; private set; }
    public LedgerAccount? LedgerAccount { get; private set; }
    public LedgerAccount? TaxLedgerAccount { get; private set; }

    private PostingMapping() { }

    public static PostingMapping Create(
        Guid financeProfileId,
        PostingMappingType mappingType,
        Guid sourceId,
        Guid ledgerAccountId,
        string createdBy,
        Guid? taxLedgerAccountId = null)
    {
        return new PostingMapping
        {
            FinanceProfileId = financeProfileId,
            MappingType = mappingType,
            SourceId = sourceId,
            LedgerAccountId = ledgerAccountId,
            TaxLedgerAccountId = taxLedgerAccountId,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(
        Guid ledgerAccountId,
        string updatedBy,
        Guid? taxLedgerAccountId = null)
    {
        LedgerAccountId = ledgerAccountId;
        TaxLedgerAccountId = taxLedgerAccountId;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }
}

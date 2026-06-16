namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-028 (E5-S1): Repository for <see cref="AutomationDefinition"/> aggregates. Mirrors the
/// <see cref="IEmailCampaignRepository"/> shape (paged list with filter, get-by-id, add/update).
/// </summary>
public interface IAutomationDefinitionRepository
{
    Task<AutomationDefinition?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<AutomationDefinition> Items, int TotalCount)> GetAllAsync(
        AutomationDefinitionFilterOptions? filter = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);

    /// <summary>All definitions in <see cref="AutomationStatus.Active"/> — the S2 dispatch eligibility set.</summary>
    Task<IReadOnlyList<AutomationDefinition>> GetActiveAsync(CancellationToken cancellationToken = default);

    Task AddAsync(AutomationDefinition definition, CancellationToken cancellationToken = default);

    Task UpdateAsync(AutomationDefinition definition, CancellationToken cancellationToken = default);
}

/// <summary>Filter options for automation-definition queries (mirrors <see cref="EmailCampaignFilterOptions"/>).</summary>
public sealed class AutomationDefinitionFilterOptions
{
    public string? SearchTerm { get; set; }
    public AutomationStatus? Status { get; set; }
    public AutomationTriggerType? TriggerType { get; set; }
    public string SortBy { get; set; } = "CreatedAt";
    public bool SortDescending { get; set; } = true;
}

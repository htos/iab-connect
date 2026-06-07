using IabConnect.Domain.Common;
using IabConnect.Domain.Privacy;

namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-028 (E5-S1): A reusable automation journey — binds a trigger (<see cref="AutomationTrigger"/>)
/// to an existing <see cref="EmailTemplate"/> (referenced by id, never duplicated) and a
/// consent-aware recipient rule (a <see cref="RecipientSegmentType"/> + optional segment id +
/// optional <see cref="ConsentType"/> filter, reusing the campaign segmentation model). Carries an
/// explicit guarded lifecycle (Draft → Active ⇄ Paused → Disabled). Only <see cref="AutomationStatus.Active"/>
/// definitions are executed by the S2 dispatch engine.
///
/// <para>Mirrors <see cref="EmailCampaign"/>: a sealed aggregate whose status methods guard their
/// transitions and throw on an illegal one.</para>
/// </summary>
public sealed class AutomationDefinition : Entity
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    /// <summary>Reference to an existing <see cref="EmailTemplate"/> (int Id) — reused, not duplicated.</summary>
    public int TemplateId { get; private set; }

    /// <summary>The trigger (type + parameters), an EF-owned value.</summary>
    public AutomationTrigger Trigger { get; private set; } = null!;

    // Recipient rule (reuses the campaign segmentation model).
    public RecipientSegmentType SegmentType { get; private set; }
    public string? SegmentFilter { get; private set; }

    /// <summary>
    /// Optional consent gate applied to the resolved recipient set
    /// (<see cref="IConsentRepository.GetUsersWithConsentAsync"/>). When set, only users who have
    /// granted this consent receive the journey.
    /// </summary>
    public ConsentType? ConsentFilter { get; private set; }

    public AutomationStatus Status { get; private set; } = AutomationStatus.Draft;

    // Creator / audit stamps (exactly as EmailCampaign carries them).
    public Guid CreatedById { get; private set; }
    public string CreatedByName { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private AutomationDefinition() { } // EF Core

    /// <summary>
    /// Factory — a new definition always starts in <see cref="AutomationStatus.Draft"/>.
    /// </summary>
    public static AutomationDefinition Create(
        string name,
        string? description,
        int templateId,
        AutomationTrigger trigger,
        RecipientSegmentType segmentType,
        string? segmentFilter,
        ConsentType? consentFilter,
        Guid createdById,
        string createdByName)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Automation name is required", nameof(name));
        ArgumentNullException.ThrowIfNull(trigger);

        return new AutomationDefinition
        {
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            TemplateId = templateId,
            Trigger = trigger,
            SegmentType = segmentType,
            SegmentFilter = segmentFilter,
            ConsentFilter = consentFilter,
            Status = AutomationStatus.Draft,
            CreatedById = createdById,
            CreatedByName = createdByName,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Structural edit (template / trigger / recipient rule / name / description). Allowed only in
    /// <see cref="AutomationStatus.Draft"/> or <see cref="AutomationStatus.Paused"/> (DEC-5) — an
    /// Active definition must be paused first so a journey is never changed mid-flight while S2 is
    /// evaluating it.
    /// </summary>
    public void Update(
        string name,
        string? description,
        int templateId,
        AutomationTrigger trigger,
        RecipientSegmentType segmentType,
        string? segmentFilter,
        ConsentType? consentFilter)
    {
        if (Status is not (AutomationStatus.Draft or AutomationStatus.Paused))
            throw new InvalidOperationException(
                $"An automation in status {Status} cannot be edited; pause it first.");

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Automation name is required", nameof(name));
        ArgumentNullException.ThrowIfNull(trigger);

        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        TemplateId = templateId;
        Trigger = trigger;
        SegmentType = segmentType;
        SegmentFilter = segmentFilter;
        ConsentFilter = consentFilter;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Draft / Disabled → Active. Throws on any other source state.</summary>
    public void Activate()
    {
        if (Status is not (AutomationStatus.Draft or AutomationStatus.Disabled))
            throw new InvalidOperationException($"Cannot activate an automation in status {Status}.");
        Status = AutomationStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Active → Paused. Throws on any other source state.</summary>
    public void Pause()
    {
        if (Status != AutomationStatus.Active)
            throw new InvalidOperationException($"Cannot pause an automation in status {Status}.");
        Status = AutomationStatus.Paused;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Paused → Active. Throws on any other source state.</summary>
    public void Resume()
    {
        if (Status != AutomationStatus.Paused)
            throw new InvalidOperationException($"Cannot resume an automation in status {Status}.");
        Status = AutomationStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Draft / Active / Paused → Disabled. Throws if already Disabled.</summary>
    public void Disable()
    {
        if (Status == AutomationStatus.Disabled)
            throw new InvalidOperationException("Automation is already disabled.");
        Status = AutomationStatus.Disabled;
        UpdatedAt = DateTime.UtcNow;
    }
}

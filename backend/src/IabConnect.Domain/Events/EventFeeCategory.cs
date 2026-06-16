using IabConnect.Domain.Common;

namespace IabConnect.Domain.Events;

/// <summary>
/// REQ-022 (E4-S1): A named, priced fee category attached to an <see cref="Event"/>. An event
/// can carry zero, one, or many categories (e.g. "Adult", "Child", "Member", "Early-bird").
/// Each carries an amount + currency, an applicability flag (members / public / everyone), an
/// optional availability window, and an optional per-category sales cap.
/// <para>
/// This is a standalone entity with its own repository (mirroring the volunteer-planning
/// aggregates), NOT a backing-field child collection of <see cref="Event"/> — this keeps the
/// Event aggregate untouched and sidesteps the aggregate-child-persistence gotcha. The legacy
/// <see cref="Event.Cost"/> / <see cref="Event.IsFree"/> display fields are independent and
/// remain the simple informational price; fee categories are the authoritative paid-registration
/// model consumed by E4-S2 (invoice) and E4-S3 (UI).
/// </para>
/// <para>
/// Currency is stored as a 3-letter ISO code string (not the Finance <c>FinanceCurrency</c> enum)
/// so the Events module stays decoupled from the Finance module; E4-S2 maps the string when it
/// raises the invoice. The Application-layer validator constrains the value to the supported set.
/// </para>
/// <para>
/// Deactivation (<see cref="Deactivate"/>) is a soft retire (<see cref="IsActive"/> = false), never
/// a hard delete, because an E4-S2 invoice may reference a category id; a deactivated category's
/// name can be reused thanks to the filtered-unique index on (event_id, name) WHERE is_active.
/// </para>
/// </summary>
public sealed class EventFeeCategory : Entity
{
    public const int NameMaxLength = 100;
    public const int DescriptionMaxLength = 500;
    public const int CurrencyCodeLength = 3;

    public Guid EventId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = "CHF";
    public FeeApplicability Applicability { get; private set; } = FeeApplicability.Everyone;
    public DateTime? AvailableFrom { get; private set; }
    public DateTime? AvailableUntil { get; private set; }
    public int? MaxQuantity { get; private set; }
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private EventFeeCategory() { }

    public static EventFeeCategory Create(
        Guid eventId,
        string name,
        decimal amount,
        string currency,
        FeeApplicability applicability,
        Guid createdBy,
        string? description = null,
        DateTime? availableFrom = null,
        DateTime? availableUntil = null,
        int? maxQuantity = null)
    {
        if (eventId == Guid.Empty) throw new ArgumentException("EventId is required", nameof(eventId));
        if (createdBy == Guid.Empty) throw new ArgumentException("CreatedBy is required", nameof(createdBy));

        var trimmedName = NormalizeName(name);
        var normalizedCurrency = NormalizeCurrency(currency);
        ValidateAmount(amount);
        var trimmedDescription = NormalizeDescription(description);
        availableFrom = DateTimeUtcGuard.EnsureUtc(availableFrom);
        availableUntil = DateTimeUtcGuard.EnsureUtc(availableUntil);
        ValidateWindow(availableFrom, availableUntil);
        ValidateMaxQuantity(maxQuantity);

        return new EventFeeCategory
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Name = trimmedName,
            Amount = amount,
            Currency = normalizedCurrency,
            Applicability = applicability,
            Description = trimmedDescription,
            AvailableFrom = availableFrom,
            AvailableUntil = availableUntil,
            MaxQuantity = maxQuantity,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public void UpdateDetails(
        string name,
        decimal amount,
        string currency,
        FeeApplicability applicability,
        string? description,
        DateTime? availableFrom,
        DateTime? availableUntil,
        int? maxQuantity)
    {
        var trimmedName = NormalizeName(name);
        var normalizedCurrency = NormalizeCurrency(currency);
        ValidateAmount(amount);
        var trimmedDescription = NormalizeDescription(description);
        availableFrom = DateTimeUtcGuard.EnsureUtc(availableFrom);
        availableUntil = DateTimeUtcGuard.EnsureUtc(availableUntil);
        ValidateWindow(availableFrom, availableUntil);
        ValidateMaxQuantity(maxQuantity);

        Name = trimmedName;
        Amount = amount;
        Currency = normalizedCurrency;
        Applicability = applicability;
        Description = trimmedDescription;
        AvailableFrom = availableFrom;
        AvailableUntil = availableUntil;
        MaxQuantity = maxQuantity;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// REQ-022 (E4-S1): Soft-retire the category. Idempotent. Never delete — an E4-S2 invoice may
    /// reference this category id; a retired name can be reused (filtered-unique index).
    /// </summary>
    public void Deactivate()
    {
        if (!IsActive) return;
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>REQ-022 (E4-S1): Re-activate a previously retired category. Idempotent.</summary>
    public void Reactivate()
    {
        if (IsActive) return;
        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// REQ-022 (E4-S1): True when the category is active and the given instant falls inside the
    /// optional availability window (open-ended on either side when the bound is null).
    /// </summary>
    public bool IsAvailableAt(DateTime instantUtc)
    {
        if (!IsActive) return false;
        if (AvailableFrom.HasValue && instantUtc < AvailableFrom.Value) return false;
        if (AvailableUntil.HasValue && instantUtc > AvailableUntil.Value) return false;
        return true;
    }

    /// <summary>
    /// REQ-022 (E4-S1): True when this category may be applied to the given registrant kind.
    /// </summary>
    public bool AppliesTo(bool isMember) => Applicability switch
    {
        FeeApplicability.Everyone => true,
        FeeApplicability.MembersOnly => isMember,
        FeeApplicability.PublicOnly => !isMember,
        _ => false,
    };

    private static string NormalizeName(string name)
    {
        var trimmed = (name ?? throw new ArgumentNullException(nameof(name))).Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new ArgumentException("Name is required", nameof(name));
        if (trimmed.Length > NameMaxLength)
            throw new ArgumentException($"Name cannot exceed {NameMaxLength} characters", nameof(name));
        return trimmed;
    }

    private static string? NormalizeDescription(string? description)
    {
        var trimmed = description?.Trim();
        if (trimmed is { Length: > DescriptionMaxLength })
            throw new ArgumentException($"Description cannot exceed {DescriptionMaxLength} characters", nameof(description));
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static string NormalizeCurrency(string currency)
    {
        var trimmed = (currency ?? throw new ArgumentNullException(nameof(currency))).Trim().ToUpperInvariant();
        if (trimmed.Length != CurrencyCodeLength || !trimmed.All(char.IsLetter))
            throw new ArgumentException($"Currency must be a {CurrencyCodeLength}-letter ISO code", nameof(currency));
        return trimmed;
    }

    private static void ValidateAmount(decimal amount)
    {
        if (amount < 0)
            throw new ArgumentException("Amount cannot be negative", nameof(amount));
        if (decimal.Round(amount, 2) != amount)
            throw new ArgumentException("Amount cannot have more than 2 decimal places", nameof(amount));
    }

    private static void ValidateWindow(DateTime? availableFrom, DateTime? availableUntil)
    {
        if (availableFrom.HasValue && availableUntil.HasValue && availableUntil.Value <= availableFrom.Value)
            throw new ArgumentException("AvailableUntil must be after AvailableFrom", nameof(availableUntil));
    }

    private static void ValidateMaxQuantity(int? maxQuantity)
    {
        if (maxQuantity.HasValue && maxQuantity.Value < 1)
            throw new ArgumentException("MaxQuantity must be at least 1 when set", nameof(maxQuantity));
    }
}

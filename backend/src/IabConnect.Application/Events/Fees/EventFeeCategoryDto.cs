using IabConnect.Domain.Events;

namespace IabConnect.Application.Events.Fees;

/// <summary>
/// REQ-022 (E4-S1): API-facing projection of <see cref="EventFeeCategory"/>.
/// <see cref="Applicability"/> is the PascalCase enum name (matched byte-for-byte by the frontend
/// TS union).
/// </summary>
public sealed record EventFeeCategoryDto(
    Guid Id,
    Guid EventId,
    string Name,
    string? Description,
    decimal Amount,
    string Currency,
    string Applicability,
    DateTime? AvailableFrom,
    DateTime? AvailableUntil,
    int? MaxQuantity,
    bool IsActive,
    DateTime CreatedAt)
{
    public static EventFeeCategoryDto FromEntity(EventFeeCategory c) =>
        new(c.Id, c.EventId, c.Name, c.Description, c.Amount, c.Currency,
            c.Applicability.ToString(), c.AvailableFrom, c.AvailableUntil,
            c.MaxQuantity, c.IsActive, c.CreatedAt);
}

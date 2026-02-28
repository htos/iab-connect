using MediatR;

namespace IabConnect.Application.Finance.Exports.Pain001;

/// <summary>
/// REQ-073: Validation-only query for pain.001 export (dry-run without generating XML).
/// </summary>
public sealed record ValidatePain001Query : IRequest<Pain001ValidationResult>
{
    public List<Guid> PaymentIds { get; init; } = [];
    public Pain001Profile Profile { get; init; }
    public DateTimeOffset? RequestedExecutionDate { get; init; }
}

using MediatR;

namespace IabConnect.Application.Finance.Exports.Pain001;

/// <summary>
/// REQ-073: Query to export approved payments as pain.001.001.09 XML.
/// </summary>
public sealed record ExportPain001Query : IRequest<Pain001ExportResult>
{
    public List<Guid> PaymentIds { get; init; } = [];
    public Pain001Profile Profile { get; init; }
    public DateTimeOffset? RequestedExecutionDate { get; init; }
}

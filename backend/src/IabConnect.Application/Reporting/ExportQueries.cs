using IabConnect.Application.Finance.Exports.Queries;
using MediatR;

namespace IabConnect.Application.Reporting;

/// <summary>
/// REQ-051: Export members list as CSV.
/// </summary>
public sealed record ExportMembersQuery : IRequest<ExportFileResult>;

/// <summary>
/// REQ-051: Export event registration list as CSV for a specific event.
/// </summary>
public sealed record ExportEventRegistrationsQuery(Guid EventId) : IRequest<ExportFileResult>;

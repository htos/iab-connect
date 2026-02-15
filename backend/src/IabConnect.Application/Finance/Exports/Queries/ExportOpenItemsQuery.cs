using MediatR;

namespace IabConnect.Application.Finance.Exports.Queries;

/// <summary>
/// Query to export open invoices as CSV (REQ-044)
/// </summary>
public sealed record ExportOpenItemsQuery : IRequest<ExportFileResult>;

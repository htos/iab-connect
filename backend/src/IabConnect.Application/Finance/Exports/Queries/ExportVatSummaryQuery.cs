using MediatR;

namespace IabConnect.Application.Finance.Exports.Queries;

/// <summary>
/// Query to export VAT summary as CSV (REQ-062)
/// </summary>
public sealed record ExportVatSummaryQuery(DateTime? From, DateTime? To) : IRequest<ExportFileResult>;

using MediatR;

namespace IabConnect.Application.Finance.Exports.Queries;

/// <summary>
/// Represents a file export result (CSV bytes + metadata)
/// </summary>
public sealed record ExportFileResult(byte[] Content, string ContentType, string FileName);

/// <summary>
/// Query to export the transaction journal as CSV (REQ-044)
/// </summary>
public sealed record ExportJournalQuery(DateTime? From, DateTime? To) : IRequest<ExportFileResult>;

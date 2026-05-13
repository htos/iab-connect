using MediatR;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023: A CSV file produced by the check-in roster export.
/// File name uses the event start date (not the export date) so all exports
/// for a given event share a recognisable prefix.
/// </summary>
public sealed record EventCheckInRosterCsvFile(byte[] Content, string FileName);

/// <summary>
/// REQ-023 (E3.S1 review H-S1-3): export envelope. Mirrors <see cref="EventCheckInRosterLookup"/>
/// so the endpoint can map archive-expired to its spec-required 404 message.
/// </summary>
public sealed record EventCheckInRosterCsvLookup(EventCheckInRosterCsvFile? File, bool ArchiveExpired)
{
    public static EventCheckInRosterCsvLookup NotFound { get; } = new(null, ArchiveExpired: false);
    public static EventCheckInRosterCsvLookup Expired { get; } = new(null, ArchiveExpired: true);
    public static EventCheckInRosterCsvLookup Ready(EventCheckInRosterCsvFile file) => new(file, ArchiveExpired: false);
}

/// <summary>
/// REQ-023: Query for the CSV export of an event's check-in roster.
/// </summary>
public sealed record ExportEventCheckInRosterQuery(Guid EventId, bool IncludeWaitlisted = false)
    : IRequest<EventCheckInRosterCsvLookup>;

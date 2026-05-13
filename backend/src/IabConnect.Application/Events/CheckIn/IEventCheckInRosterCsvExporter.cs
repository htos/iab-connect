namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023: Renders the check-in roster as an event-day-print-friendly CSV
/// (UTF-8 BOM, CRLF, comma-separated, RFC-4180-quoted).
/// </summary>
public interface IEventCheckInRosterCsvExporter
{
    byte[] Export(EventCheckInRosterDto roster);
}

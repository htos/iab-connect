using System.Globalization;
using System.Text;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance.Exports.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Events;
using MediatR;

namespace IabConnect.Application.Reporting;

/// <summary>
/// REQ-051: Exports event registrations as CSV for a specific event.
/// </summary>
public sealed class ExportEventRegistrationsQueryHandler
    : IRequestHandler<ExportEventRegistrationsQuery, ExportFileResult>
{
    private readonly IEventRepository _eventRepository;
    private readonly IEventRegistrationRepository _registrationRepository;
    private readonly IAuditService _auditService;

    public ExportEventRegistrationsQueryHandler(
        IEventRepository eventRepository,
        IEventRegistrationRepository registrationRepository,
        IAuditService auditService)
    {
        _eventRepository = eventRepository;
        _registrationRepository = registrationRepository;
        _auditService = auditService;
    }

    public async Task<ExportFileResult> Handle(ExportEventRegistrationsQuery request, CancellationToken ct)
    {
        var evt = await _eventRepository.GetByIdAsync(request.EventId, ct);
        if (evt is null)
            throw new KeyNotFoundException($"Event {request.EventId} not found");

        var registrations = await _registrationRepository.GetByEventIdAsync(request.EventId, cancellationToken: ct);

        var sb = new StringBuilder();
        sb.AppendLine("ParticipantName;Email;Phone;Status;NumberOfGuests;RegisteredAt;ConfirmedAt;CheckedInAt;SpecialRequirements;Notes");

        foreach (var r in registrations.OrderBy(r => r.ParticipantName))
        {
            sb.AppendLine(string.Join(";",
                EscapeCsv(r.ParticipantName),
                EscapeCsv(r.ParticipantEmail),
                EscapeCsv(r.ParticipantPhone),
                r.Status.ToString(),
                r.NumberOfGuests.ToString(CultureInfo.InvariantCulture),
                r.RegisteredAt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                r.ConfirmedAt?.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) ?? "",
                r.CheckedInAt?.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) ?? "",
                EscapeCsv(r.SpecialRequirements),
                EscapeCsv(r.Notes)));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var safeTitle = evt.Title.Replace(" ", "_").Replace(";", "");
        var fileName = $"registrations_{safeTitle}_{DateTime.UtcNow:yyyyMMdd}.csv";

        await _auditService.LogActionAsync(
            AuditEventType.DataExported,
            $"Event registrations exported for '{evt.Title}' ({registrations.Count} records)",
            entityType: "EventRegistration",
            entityId: request.EventId.ToString(),
            ct: ct);

        return new ExportFileResult(bytes, "text/csv", fileName);
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(';') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}

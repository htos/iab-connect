using System.Text;
using MediatR;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023: Handler for <see cref="ExportEventCheckInRosterQuery"/>.
/// Delegates roster building to <see cref="GetEventCheckInRosterQuery"/> and
/// CSV rendering to <see cref="IEventCheckInRosterCsvExporter"/>.
/// </summary>
public sealed class ExportEventCheckInRosterQueryHandler
    : IRequestHandler<ExportEventCheckInRosterQuery, EventCheckInRosterCsvLookup>
{
    /// <summary>
    /// REQ-023 (E3.S1 review M-S1-1): cap the sanitized event title segment so a 250-char
    /// event title doesn't produce a 270-char file name (Windows path limit + cross-platform
    /// portability). 80 characters is enough for printed-roster recognisability.
    /// </summary>
    private const int FileNameTitleSegmentMaxLength = 80;

    private readonly IMediator _mediator;
    private readonly IEventCheckInRosterCsvExporter _exporter;

    public ExportEventCheckInRosterQueryHandler(
        IMediator mediator,
        IEventCheckInRosterCsvExporter exporter)
    {
        _mediator = mediator;
        _exporter = exporter;
    }

    public async Task<EventCheckInRosterCsvLookup> Handle(
        ExportEventCheckInRosterQuery request,
        CancellationToken cancellationToken)
    {
        var lookup = await _mediator.Send(
            new GetEventCheckInRosterQuery(request.EventId, request.IncludeWaitlisted),
            cancellationToken);

        if (lookup.ArchiveExpired)
            return EventCheckInRosterCsvLookup.Expired;
        if (lookup.Roster is null)
            return EventCheckInRosterCsvLookup.NotFound;

        var content = _exporter.Export(lookup.Roster);
        var fileName = BuildFileName(lookup.Roster);
        return EventCheckInRosterCsvLookup.Ready(new EventCheckInRosterCsvFile(content, fileName));
    }

    /// <summary>
    /// REQ-023 (E3.S1 review M-S1-1): build a portable, length-capped file name. We strip the
    /// platform-specific invalid set, plus the common Windows-only forbidden chars (so a Linux
    /// host doesn't emit a name that Windows then refuses to write), plus Unicode bidi and
    /// zero-width characters that can hide one filename behind another in the download dialog.
    /// </summary>
    private static string BuildFileName(EventCheckInRosterDto roster)
    {
        var safeTitle = SanitizeForFileName(roster.EventTitle);
        if (safeTitle.Length > FileNameTitleSegmentMaxLength)
            safeTitle = safeTitle[..FileNameTitleSegmentMaxLength].TrimEnd('_');
        if (string.IsNullOrEmpty(safeTitle))
            safeTitle = "event";
        return $"Checkin_{safeTitle}_{roster.EventStartDate:yyyy-MM-dd}.csv";
    }

    private static string SanitizeForFileName(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
            return string.Empty;
        // Union of platform-invalid sets so a Linux-generated name is still safe on Windows.
        var invalid = new HashSet<char>(Path.GetInvalidFileNameChars());
        foreach (var ch in new[] { '<', '>', ':', '"', '/', '\\', '|', '?', '*' })
            invalid.Add(ch);

        var sb = new StringBuilder(title.Length);
        foreach (var ch in title)
        {
            // Drop control chars, bidi overrides (RLO/LRO/RLM/LRM/PDF/...) and zero-width
            // formatting marks — these are filename-spoof vectors in download dialogs.
            if (char.IsControl(ch)) { sb.Append('_'); continue; }
            if (IsBidiOrZeroWidth(ch)) { sb.Append('_'); continue; }
            if (invalid.Contains(ch)) { sb.Append('_'); continue; }
            sb.Append(ch);
        }
        // Collapse runs of underscore + trim leading/trailing dots and spaces (Windows reserves them).
        var collapsed = System.Text.RegularExpressions.Regex.Replace(sb.ToString(), "_+", "_");
        return collapsed.Trim('.', ' ', '_');
    }

    private static bool IsBidiOrZeroWidth(char ch) => ch switch
    {
        '​' or '‌' or '‍' or '‎' or '‏'
            or '‪' or '‫' or '‬' or '‭' or '‮'
            or '⁠' or '﻿' => true,
        _ => false,
    };
}

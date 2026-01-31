namespace IabConnect.Domain.Events;

/// <summary>
/// REQ-020: Repository-Interface für Event-Anmeldungen.
/// </summary>
public interface IEventRegistrationRepository
{
    /// <summary>
    /// Fügt eine neue Anmeldung hinzu.
    /// </summary>
    Task AddAsync(EventRegistration registration, CancellationToken cancellationToken = default);

    /// <summary>
    /// Aktualisiert eine bestehende Anmeldung.
    /// </summary>
    Task UpdateAsync(EventRegistration registration, CancellationToken cancellationToken = default);

    /// <summary>
    /// Holt eine Anmeldung per ID.
    /// </summary>
    Task<EventRegistration?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Holt eine Anmeldung per QR-Code Token.
    /// </summary>
    Task<EventRegistration?> GetByQrCodeTokenAsync(string qrCodeToken, CancellationToken cancellationToken = default);

    /// <summary>
    /// Holt alle Anmeldungen für ein Event.
    /// </summary>
    Task<IReadOnlyList<EventRegistration>> GetByEventIdAsync(
        Guid eventId,
        EventRegistrationFilterOptions? filter = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Holt alle Anmeldungen eines Benutzers.
    /// </summary>
    Task<IReadOnlyList<EventRegistration>> GetByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Holt alle Anmeldungen eines Mitglieds.
    /// </summary>
    Task<IReadOnlyList<EventRegistration>> GetByMemberIdAsync(
        Guid memberId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Prüft, ob ein Benutzer bereits für ein Event angemeldet ist.
    /// </summary>
    Task<bool> ExistsAsync(
        Guid eventId,
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Prüft, ob eine E-Mail bereits für ein Event angemeldet ist.
    /// </summary>
    Task<bool> ExistsByEmailAsync(
        Guid eventId,
        string email,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Zählt bestätigte Anmeldungen für ein Event.
    /// </summary>
    Task<int> CountConfirmedAsync(
        Guid eventId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Zählt die Gesamtzahl der Teilnehmer (inkl. Begleitpersonen) für ein Event.
    /// </summary>
    Task<int> CountTotalParticipantsAsync(
        Guid eventId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Zählt Wartelisten-Einträge für ein Event.
    /// </summary>
    Task<int> CountWaitlistedAsync(
        Guid eventId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Holt die Warteliste für ein Event (sortiert nach Position).
    /// </summary>
    Task<IReadOnlyList<EventRegistration>> GetWaitlistAsync(
        Guid eventId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Holt die nächste Person auf der Warteliste.
    /// </summary>
    Task<EventRegistration?> GetNextOnWaitlistAsync(
        Guid eventId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Holt Statistiken für ein Event.
    /// </summary>
    Task<EventRegistrationStatistics> GetStatisticsAsync(
        Guid eventId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Holt paginierte Anmeldungen für ein Event.
    /// </summary>
    Task<(IReadOnlyList<EventRegistration> Items, int TotalCount)> GetPagedAsync(
        Guid eventId,
        EventRegistrationFilterOptions? filter,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Filter-Optionen für Event-Anmeldungen.
/// </summary>
public class EventRegistrationFilterOptions
{
    /// <summary>
    /// Filter nach Status.
    /// </summary>
    public RegistrationStatus? Status { get; set; }

    /// <summary>
    /// Nur Wartelisten-Einträge.
    /// </summary>
    public bool? IsWaitlisted { get; set; }

    /// <summary>
    /// Nur eingecheckte Teilnehmer.
    /// </summary>
    public bool? IsCheckedIn { get; set; }

    /// <summary>
    /// Nur No-Shows.
    /// </summary>
    public bool? IsNoShow { get; set; }

    /// <summary>
    /// Suche nach Name oder E-Mail.
    /// </summary>
    public string? SearchTerm { get; set; }

    /// <summary>
    /// Sortierung.
    /// </summary>
    public RegistrationSortBy SortBy { get; set; } = RegistrationSortBy.RegisteredAt;

    /// <summary>
    /// Sortierrichtung.
    /// </summary>
    public bool SortDescending { get; set; } = true;
}

/// <summary>
/// Sortieroptionen für Event-Anmeldungen.
/// </summary>
public enum RegistrationSortBy
{
    RegisteredAt,
    ParticipantName,
    Status,
    WaitlistPosition,
    CheckedInAt
}

/// <summary>
/// Statistiken für Event-Anmeldungen.
/// </summary>
public class EventRegistrationStatistics
{
    public int TotalRegistrations { get; set; }
    public int ConfirmedCount { get; set; }
    public int PendingCount { get; set; }
    public int WaitlistedCount { get; set; }
    public int CancelledCount { get; set; }
    public int CheckedInCount { get; set; }
    public int NoShowCount { get; set; }
    public int TotalParticipants { get; set; } // Inkl. Begleitpersonen
    public int TotalGuests { get; set; } // Nur Begleitpersonen (NumberOfGuests - 1)
}

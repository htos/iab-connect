using IabConnect.Domain.Common;

namespace IabConnect.Domain.Events;

/// <summary>
/// REQ-020: Event-Anmeldung / RSVP
/// Repräsentiert eine Anmeldung/Registrierung für ein Event.
/// </summary>
public sealed class EventRegistration : Entity
{
    /// <summary>
    /// Das Event, für das die Anmeldung gilt.
    /// </summary>
    public Guid EventId { get; private set; }

    /// <summary>
    /// Der Benutzer, der sich angemeldet hat (optional für öffentliche Events).
    /// </summary>
    public Guid? UserId { get; private set; }

    /// <summary>
    /// Das Mitglied, das sich angemeldet hat (optional).
    /// </summary>
    public Guid? MemberId { get; private set; }

    /// <summary>
    /// Name des Teilnehmers (für Gäste ohne Account).
    /// </summary>
    public string ParticipantName { get; private set; } = string.Empty;

    /// <summary>
    /// E-Mail des Teilnehmers.
    /// </summary>
    public string ParticipantEmail { get; private set; } = string.Empty;

    /// <summary>
    /// Telefon des Teilnehmers (optional).
    /// </summary>
    public string? ParticipantPhone { get; private set; }

    /// <summary>
    /// Anzahl der angemeldeten Personen (z.B. für Familien).
    /// </summary>
    public int NumberOfGuests { get; private set; } = 1;

    /// <summary>
    /// Status der Anmeldung.
    /// </summary>
    public RegistrationStatus Status { get; private set; } = RegistrationStatus.Confirmed;

    /// <summary>
    /// Ob der Teilnehmer auf der Warteliste ist.
    /// </summary>
    public bool IsWaitlisted { get; private set; }

    /// <summary>
    /// Position auf der Warteliste (1-basiert, null wenn nicht auf Warteliste).
    /// </summary>
    public int? WaitlistPosition { get; private set; }

    /// <summary>
    /// Zeitpunkt der Anmeldung.
    /// </summary>
    public DateTime RegisteredAt { get; private set; }

    /// <summary>
    /// Zeitpunkt der Bestätigung (wenn eine Bestätigung erforderlich war).
    /// </summary>
    public DateTime? ConfirmedAt { get; private set; }

    /// <summary>
    /// Zeitpunkt der Stornierung.
    /// </summary>
    public DateTime? CancelledAt { get; private set; }

    /// <summary>
    /// Grund für die Stornierung.
    /// </summary>
    public string? CancellationReason { get; private set; }

    /// <summary>
    /// Ob der Teilnehmer storniert hat (vs. Admin-Stornierung).
    /// </summary>
    public bool CancelledByParticipant { get; private set; }

    /// <summary>
    /// Zeitpunkt des Check-ins beim Event.
    /// </summary>
    public DateTime? CheckedInAt { get; private set; }

    /// <summary>
    /// Wer den Check-in durchgeführt hat.
    /// </summary>
    public Guid? CheckedInBy { get; private set; }

    /// <summary>
    /// No-Show Markierung (nicht erschienen).
    /// </summary>
    public bool IsNoShow { get; private set; }

    /// <summary>
    /// Zusätzliche Notizen zur Anmeldung.
    /// </summary>
    public string? Notes { get; private set; }

    /// <summary>
    /// Spezielle Anforderungen (Barrierefreiheit, Ernährung, etc.).
    /// </summary>
    public string? SpecialRequirements { get; private set; }

    /// <summary>
    /// QR-Code für Check-in (eindeutiger Token).
    /// </summary>
    public string QrCodeToken { get; private set; } = string.Empty;

    /// <summary>
    /// Zeitpunkt der Erstellung.
    /// </summary>
    public DateTime CreatedAt { get; private set; }

    /// <summary>
    /// Zeitpunkt der letzten Änderung.
    /// </summary>
    public DateTime? UpdatedAt { get; private set; }

    private EventRegistration() { }

    /// <summary>
    /// Factory method: Erstellt eine neue Event-Anmeldung für ein Mitglied.
    /// </summary>
    public static EventRegistration CreateForMember(
        Guid eventId,
        Guid userId,
        Guid memberId,
        string participantName,
        string participantEmail,
        int numberOfGuests = 1,
        string? participantPhone = null,
        string? specialRequirements = null)
    {
        ValidateBasicParameters(eventId, participantName, participantEmail, numberOfGuests);

        return new EventRegistration
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            UserId = userId,
            MemberId = memberId,
            ParticipantName = participantName.Trim(),
            ParticipantEmail = participantEmail.Trim().ToLowerInvariant(),
            ParticipantPhone = participantPhone?.Trim(),
            NumberOfGuests = numberOfGuests,
            SpecialRequirements = specialRequirements?.Trim(),
            Status = RegistrationStatus.Confirmed,
            RegisteredAt = DateTime.UtcNow,
            ConfirmedAt = DateTime.UtcNow,
            QrCodeToken = GenerateQrCodeToken(),
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Factory method: Erstellt eine neue Event-Anmeldung für einen Gast (ohne Account).
    /// </summary>
    public static EventRegistration CreateForGuest(
        Guid eventId,
        string participantName,
        string participantEmail,
        int numberOfGuests = 1,
        string? participantPhone = null,
        string? specialRequirements = null)
    {
        ValidateBasicParameters(eventId, participantName, participantEmail, numberOfGuests);

        return new EventRegistration
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            UserId = null,
            MemberId = null,
            ParticipantName = participantName.Trim(),
            ParticipantEmail = participantEmail.Trim().ToLowerInvariant(),
            ParticipantPhone = participantPhone?.Trim(),
            NumberOfGuests = numberOfGuests,
            SpecialRequirements = specialRequirements?.Trim(),
            Status = RegistrationStatus.Pending, // Gäste benötigen Bestätigung
            RegisteredAt = DateTime.UtcNow,
            QrCodeToken = GenerateQrCodeToken(),
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Factory method: Erstellt eine Wartelisten-Anmeldung.
    /// </summary>
    public static EventRegistration CreateWaitlisted(
        Guid eventId,
        Guid? userId,
        Guid? memberId,
        string participantName,
        string participantEmail,
        int waitlistPosition,
        int numberOfGuests = 1,
        string? participantPhone = null,
        string? specialRequirements = null)
    {
        ValidateBasicParameters(eventId, participantName, participantEmail, numberOfGuests);

        if (waitlistPosition < 1)
            throw new ArgumentException("Waitlist position must be at least 1", nameof(waitlistPosition));

        return new EventRegistration
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            UserId = userId,
            MemberId = memberId,
            ParticipantName = participantName.Trim(),
            ParticipantEmail = participantEmail.Trim().ToLowerInvariant(),
            ParticipantPhone = participantPhone?.Trim(),
            NumberOfGuests = numberOfGuests,
            SpecialRequirements = specialRequirements?.Trim(),
            Status = RegistrationStatus.Waitlisted,
            IsWaitlisted = true,
            WaitlistPosition = waitlistPosition,
            RegisteredAt = DateTime.UtcNow,
            QrCodeToken = GenerateQrCodeToken(),
            CreatedAt = DateTime.UtcNow
        };
    }

    private static void ValidateBasicParameters(
        Guid eventId,
        string participantName,
        string participantEmail,
        int numberOfGuests)
    {
        if (eventId == Guid.Empty)
            throw new ArgumentException("Event ID is required", nameof(eventId));
        if (string.IsNullOrWhiteSpace(participantName))
            throw new ArgumentException("Participant name is required", nameof(participantName));
        if (string.IsNullOrWhiteSpace(participantEmail))
            throw new ArgumentException("Participant email is required", nameof(participantEmail));
        if (!IsValidEmail(participantEmail))
            throw new ArgumentException("Invalid email format", nameof(participantEmail));
        if (numberOfGuests < 1)
            throw new ArgumentException("Number of guests must be at least 1", nameof(numberOfGuests));
        if (numberOfGuests > 20)
            throw new ArgumentException("Number of guests cannot exceed 20", nameof(numberOfGuests));
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email.Trim();
        }
        catch
        {
            return false;
        }
    }

    private static string GenerateQrCodeToken()
    {
        // Generate a unique token for QR code check-in
        return $"REG-{Guid.NewGuid():N}".ToUpperInvariant()[..24];
    }

    /// <summary>
    /// Bestätigt die Anmeldung.
    /// </summary>
    public void Confirm()
    {
        if (Status == RegistrationStatus.Cancelled)
            throw new InvalidOperationException("Cannot confirm a cancelled registration");
        if (Status == RegistrationStatus.Confirmed)
            return; // Already confirmed

        Status = RegistrationStatus.Confirmed;
        ConfirmedAt = DateTime.UtcNow;
        IsWaitlisted = false;
        WaitlistPosition = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Storniert die Anmeldung.
    /// </summary>
    public void Cancel(string? reason = null, bool cancelledByParticipant = true)
    {
        if (Status == RegistrationStatus.Cancelled)
            throw new InvalidOperationException("Registration is already cancelled");

        Status = RegistrationStatus.Cancelled;
        CancelledAt = DateTime.UtcNow;
        CancellationReason = reason?.Trim();
        CancelledByParticipant = cancelledByParticipant;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Checkt den Teilnehmer ein.
    /// REQ-023 (E3.S2): idempotent — calling twice returns the same <see cref="CheckInResult"/>
    /// with <c>WasAlreadyCheckedIn = true</c>; entity state is NOT mutated on the second call.
    /// </summary>
    public CheckInResult CheckIn(Guid checkedInBy)
    {
        // REQ-023 (E3.S2 review H-S2-4): reject Pending and NoShow up front. Roster discipline
        // means only confirmed-and-not-cancelled rows are eligible to check in; allowing Pending
        // (never confirmed) or NoShow (already decided absent) silently re-opens the front
        // gate for invalid states.
        if (Status == RegistrationStatus.Cancelled)
            throw new InvalidOperationException("Cannot check in a cancelled registration");
        if (Status == RegistrationStatus.Waitlisted)
            throw new InvalidOperationException("Cannot check in a waitlisted registration");
        if (Status == RegistrationStatus.Pending)
            throw new InvalidOperationException("Cannot check in a pending (un-confirmed) registration");
        if (Status == RegistrationStatus.NoShow)
            throw new InvalidOperationException("Cannot check in a no-show registration; revert no-show first");

        if (CheckedInAt.HasValue)
            return new CheckInResult(
                // REQ-023 (E3.S2 review M-S2-1): preserve the original CheckedInBy on the idempotent
                // path. The previous fallback `CheckedInBy ?? checkedInBy` would attribute a legacy
                // null-attributed check-in to the second caller, which is wrong for audit. The
                // CheckedInBy field is now never null after a successful first check-in, so the
                // fallback can only fire on rows that pre-date the audit trail — surface those
                // as "Guid.Empty (legacy)" rather than silently falsifying attribution.
                WasAlreadyCheckedIn: true,
                CheckedInAt: CheckedInAt.Value,
                CheckedInBy: CheckedInBy ?? Guid.Empty);

        CheckedInAt = DateTime.UtcNow;
        CheckedInBy = checkedInBy;
        Status = RegistrationStatus.CheckedIn;
        UpdatedAt = DateTime.UtcNow;

        return new CheckInResult(
            WasAlreadyCheckedIn: false,
            CheckedInAt: CheckedInAt.Value,
            CheckedInBy: checkedInBy);
    }

    /// <summary>
    /// Markiert den Teilnehmer als No-Show.
    /// </summary>
    public void MarkAsNoShow()
    {
        if (Status == RegistrationStatus.Cancelled)
            throw new InvalidOperationException("Cannot mark a cancelled registration as no-show");
        if (Status == RegistrationStatus.CheckedIn)
            throw new InvalidOperationException("Cannot mark a checked-in participant as no-show");

        IsNoShow = true;
        Status = RegistrationStatus.NoShow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Setzt den No-Show-Status zurück auf Bestätigt.
    /// </summary>
    public void RevertNoShow()
    {
        if (Status != RegistrationStatus.NoShow)
            throw new InvalidOperationException("Can only revert a no-show registration");

        IsNoShow = false;
        Status = RegistrationStatus.Confirmed;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Setzt den Check-In-Status zurück auf Bestätigt.
    /// </summary>
    public void RevertCheckIn()
    {
        if (Status != RegistrationStatus.CheckedIn)
            throw new InvalidOperationException("Can only revert a checked-in registration");

        CheckedInAt = null;
        CheckedInBy = null;
        Status = RegistrationStatus.Confirmed;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Setzt die Stornierung zurück auf Bestätigt.
    /// </summary>
    public void RevertCancellation()
    {
        if (Status != RegistrationStatus.Cancelled)
            throw new InvalidOperationException("Can only revert a cancelled registration");

        CancelledAt = null;
        CancellationReason = null;
        CancelledByParticipant = false;
        Status = RegistrationStatus.Confirmed;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Verschiebt auf die Warteliste.
    /// </summary>
    public void MoveToWaitlist(int position)
    {
        if (position < 1)
            throw new ArgumentException("Waitlist position must be at least 1", nameof(position));
        if (Status == RegistrationStatus.Cancelled)
            throw new InvalidOperationException("Cannot move a cancelled registration to waitlist");

        Status = RegistrationStatus.Waitlisted;
        IsWaitlisted = true;
        WaitlistPosition = position;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Rückt von der Warteliste nach (bestätigt die Anmeldung).
    /// </summary>
    public void PromoteFromWaitlist()
    {
        if (!IsWaitlisted)
            throw new InvalidOperationException("Registration is not on waitlist");

        Confirm();
    }

    /// <summary>
    /// Aktualisiert die Wartelisten-Position.
    /// </summary>
    public void UpdateWaitlistPosition(int newPosition)
    {
        if (!IsWaitlisted)
            throw new InvalidOperationException("Registration is not on waitlist");
        if (newPosition < 1)
            throw new ArgumentException("Waitlist position must be at least 1", nameof(newPosition));

        WaitlistPosition = newPosition;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Aktualisiert die Teilnehmer-Details.
    /// </summary>
    public void UpdateDetails(
        string participantName,
        string participantEmail,
        string? participantPhone,
        int numberOfGuests,
        string? specialRequirements,
        string? notes)
    {
        if (Status == RegistrationStatus.Cancelled)
            throw new InvalidOperationException("Cannot update a cancelled registration");

        if (string.IsNullOrWhiteSpace(participantName))
            throw new ArgumentException("Participant name is required", nameof(participantName));
        if (string.IsNullOrWhiteSpace(participantEmail))
            throw new ArgumentException("Participant email is required", nameof(participantEmail));
        if (!IsValidEmail(participantEmail))
            throw new ArgumentException("Invalid email format", nameof(participantEmail));
        if (numberOfGuests < 1 || numberOfGuests > 20)
            throw new ArgumentException("Number of guests must be between 1 and 20", nameof(numberOfGuests));

        ParticipantName = participantName.Trim();
        ParticipantEmail = participantEmail.Trim().ToLowerInvariant();
        ParticipantPhone = participantPhone?.Trim();
        NumberOfGuests = numberOfGuests;
        SpecialRequirements = specialRequirements?.Trim();
        Notes = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Generiert einen neuen QR-Code Token (z.B. bei Kompromittierung).
    /// </summary>
    public void RegenerateQrCodeToken()
    {
        QrCodeToken = GenerateQrCodeToken();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Gibt an, ob die Anmeldung aktiv ist (nicht storniert, nicht no-show).
    /// </summary>
    public bool IsActive => Status != RegistrationStatus.Cancelled && Status != RegistrationStatus.NoShow;

    /// <summary>
    /// Gibt an, ob der Teilnehmer bereits eingecheckt ist.
    /// </summary>
    public bool IsCheckedIn => CheckedInAt.HasValue;

    /// <summary>
    /// Gibt die Gesamtzahl der Teilnehmer zurück (inkl. Begleitpersonen).
    /// </summary>
    public int TotalParticipants => NumberOfGuests;
}

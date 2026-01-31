namespace IabConnect.Domain.Events;

/// <summary>
/// REQ-020: Status einer Event-Anmeldung.
/// </summary>
public enum RegistrationStatus
{
    /// <summary>
    /// Anmeldung wartet auf Bestätigung (z.B. für Gäste).
    /// </summary>
    Pending = 0,

    /// <summary>
    /// Anmeldung ist bestätigt.
    /// </summary>
    Confirmed = 1,

    /// <summary>
    /// Anmeldung wurde storniert.
    /// </summary>
    Cancelled = 2,

    /// <summary>
    /// Teilnehmer steht auf der Warteliste.
    /// </summary>
    Waitlisted = 3,

    /// <summary>
    /// Teilnehmer ist eingecheckt (beim Event erschienen).
    /// </summary>
    CheckedIn = 4,

    /// <summary>
    /// Teilnehmer ist nicht erschienen (No-Show).
    /// </summary>
    NoShow = 5
}

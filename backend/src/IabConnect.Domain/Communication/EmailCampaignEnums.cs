namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-026: Status einer E-Mail-Kampagne
/// </summary>
public enum EmailCampaignStatus
{
    /// <summary>Kampagne wird erstellt</summary>
    Draft = 0,

    /// <summary>Kampagne ist geplant für späteren Versand</summary>
    Scheduled = 1,

    /// <summary>Kampagne wird gerade versendet</summary>
    Sending = 2,

    /// <summary>Kampagne wurde vollständig versendet</summary>
    Sent = 3,

    /// <summary>Kampagne wurde abgebrochen</summary>
    Cancelled = 4,

    /// <summary>Versand fehlgeschlagen</summary>
    Failed = 5
}

/// <summary>
/// REQ-026: Status eines einzelnen E-Mail-Empfängers
/// </summary>
public enum EmailRecipientStatus
{
    /// <summary>Noch nicht versendet</summary>
    Pending = 0,

    /// <summary>Erfolgreich versendet</summary>
    Sent = 1,

    /// <summary>Zustellung bestätigt (delivered)</summary>
    Delivered = 2,

    /// <summary>E-Mail geöffnet</summary>
    Opened = 3,

    /// <summary>Link geklickt</summary>
    Clicked = 4,

    /// <summary>Bounce (hard oder soft)</summary>
    Bounced = 5,

    /// <summary>Spam-Beschwerde</summary>
    Complained = 6,

    /// <summary>Abgemeldet</summary>
    Unsubscribed = 7,

    /// <summary>Versand fehlgeschlagen</summary>
    Failed = 8,

    /// <summary>Übersprungen (z.B. keine gültige E-Mail)</summary>
    Skipped = 9
}

/// <summary>
/// REQ-026: Typ der Bounce-Nachricht
/// </summary>
public enum BounceType
{
    None = 0,
    Soft = 1,  // Temporär (z.B. Postfach voll)
    Hard = 2   // Permanent (z.B. Adresse existiert nicht)
}

/// <summary>
/// REQ-026: Segment-Typ für Kampagnen-Empfänger
/// </summary>
public enum RecipientSegmentType
{
    /// <summary>Alle aktiven Mitglieder</summary>
    AllActiveMembers = 0,

    /// <summary>Benutzerdefiniertes Segment (Filter)</summary>
    Custom = 1,

    /// <summary>Manuell ausgewählte Empfänger</summary>
    Manual = 2,

    /// <summary>Event-Teilnehmer</summary>
    EventParticipants = 3,

    /// <summary>Nur Newsletter-Abonnenten</summary>
    NewsletterSubscribers = 4,

    /// <summary>Mitglieder-Segment (REQ-017)</summary>
    MemberSegment = 5
}

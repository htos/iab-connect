namespace IabConnect.Domain.Privacy;

/// <summary>
/// Types of consent that users can grant or revoke (REQ-012: DSGVO)
/// </summary>
public enum ConsentType
{
    /// <summary>
    /// Required consent for basic data processing as per membership
    /// </summary>
    DataProcessing = 0,

    /// <summary>
    /// Newsletter subscription
    /// </summary>
    Newsletter = 1,

    /// <summary>
    /// Marketing communications
    /// </summary>
    Marketing = 2,

    /// <summary>
    /// Event notifications and reminders
    /// </summary>
    EventNotifications = 3,

    /// <summary>
    /// Photo/media usage consent
    /// </summary>
    PhotoUsage = 4
}

namespace IabConnect.Domain.Sponsors;

/// <summary>
/// Status of a sponsor relationship
/// </summary>
public enum SponsorStatus
{
    /// <summary>Prospect, not yet confirmed</summary>
    Prospect = 0,

    /// <summary>Active sponsor with valid agreement</summary>
    Active = 1,

    /// <summary>Sponsor is currently paused</summary>
    Paused = 2,

    /// <summary>Sponsorship ended</summary>
    Ended = 3
}

/// <summary>
/// Sponsoring tier/level
/// </summary>
public enum SponsorTier
{
    /// <summary>Bronze level sponsoring</summary>
    Bronze = 0,

    /// <summary>Silver level sponsoring</summary>
    Silver = 1,

    /// <summary>Gold level sponsoring</summary>
    Gold = 2,

    /// <summary>Platinum level sponsoring</summary>
    Platinum = 3
}

/// <summary>
/// Status of a supplier relationship
/// </summary>
public enum SupplierStatus
{
    /// <summary>Prospect, not yet approved</summary>
    Prospect = 0,

    /// <summary>Active and approved supplier</summary>
    Active = 1,

    /// <summary>Supplier is currently paused</summary>
    Paused = 2,

    /// <summary>Supplier relationship ended</summary>
    Ended = 3
}

/// <summary>
/// Type of entity linked to a contract/document
/// </summary>
public enum ContractLinkType
{
    /// <summary>Link to a document in the Documents module</summary>
    Document = 0,

    /// <summary>Link to an invoice in the Finance module</summary>
    Invoice = 1,

    /// <summary>Link to an event</summary>
    Event = 2
}

namespace IabConnect.Domain.Events;

/// <summary>
/// REQ-022 (E4-S1): Who a fee category applies to. Lets an event price members and
/// public visitors differently (or the same, via <see cref="Everyone"/>). The
/// registration paths in E4-S2/S3 filter the applicable active categories by the
/// registrant kind: a public guest sees <see cref="Everyone"/> + <see cref="PublicOnly"/>;
/// a logged-in member sees <see cref="Everyone"/> + <see cref="MembersOnly"/>.
/// </summary>
public enum FeeApplicability
{
    /// <summary>Applies to both members and public visitors.</summary>
    Everyone = 0,

    /// <summary>Applies only to registrations made by a linked member.</summary>
    MembersOnly = 1,

    /// <summary>Applies only to public / guest registrations.</summary>
    PublicOnly = 2
}

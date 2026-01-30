using MediatR;

namespace IabConnect.Application.Members.Commands;

/// <summary>
/// Command to create a new member
/// REQ-014: Mitglied erstellen
/// </summary>
public sealed record CreateMemberCommand : IRequest<Guid>
{
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public required string Email { get; init; }
    public string? Phone { get; init; }
    public required string Street { get; init; }
    public required string City { get; init; }
    public required string PostalCode { get; init; }
    public required string Country { get; init; }
    public required MembershipType MembershipType { get; init; }
}

public enum MembershipType
{
    Regular,
    Student,
    Family,
    Honorary
}

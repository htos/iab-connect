using IabConnect.Application.Members.Duplicates;
using MediatR;

namespace IabConnect.Application.Members.Queries;

/// <summary>
/// REQ-018: Query for duplicate-member candidates by partial identifying signals.
/// All parameters are optional. With no signals, the result is empty.
/// </summary>
public sealed record FindMemberDuplicatesQuery(
    string? Email,
    string? Phone,
    string? FirstName,
    string? LastName,
    string? PostalCode,
    Guid? ExcludeMemberId) : IRequest<IReadOnlyList<DuplicateCandidateDto>>;

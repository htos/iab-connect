using MediatR;

namespace IabConnect.Application.Members.Queries;

/// <summary>
/// Query to get paginated member list
/// REQ-013: Mitgliederliste mit Suche und Filterung
/// </summary>
public sealed record GetMembersQuery : IRequest<GetMembersResult>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? SearchTerm { get; init; }
    public MembershipStatus? Status { get; init; }
    public MembershipType? Type { get; init; }
}

public sealed record GetMembersResult
{
    public required IReadOnlyList<MemberDto> Items { get; init; }
    public required int TotalCount { get; init; }
    public required int Page { get; init; }
    public required int PageSize { get; init; }
}

public sealed record MemberDto
{
    public required Guid Id { get; init; }
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public required string Email { get; init; }
    public string? Phone { get; init; }
    public required MembershipStatus Status { get; init; }
    public required MembershipType Type { get; init; }
    public required DateOnly MemberSince { get; init; }
}

public enum MembershipStatus
{
    Active,
    Inactive,
    Pending,
    Suspended
}

public enum MembershipType
{
    Regular,
    Student,
    Family,
    Honorary
}

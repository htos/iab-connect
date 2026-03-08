using MediatR;
using IabConnect.Domain.Operations;

namespace IabConnect.Application.Retention;

/// <summary>
/// REQ-057: Query to get all retention policies.
/// </summary>
public sealed record GetRetentionPoliciesQuery : IRequest<List<RetentionPolicyDto>>;

/// <summary>
/// REQ-057: Query to get a specific retention policy.
/// </summary>
public sealed record GetRetentionPolicyByIdQuery(Guid Id) : IRequest<RetentionPolicyDto?>;

/// <summary>
/// REQ-057: Command to update a retention policy.
/// </summary>
public sealed record UpdateRetentionPolicyCommand(
    Guid Id,
    string DisplayName,
    int RetentionMonths,
    string Action,
    string? LegalBasis,
    bool IsActive
) : IRequest<RetentionPolicyDto?>;

/// <summary>
/// REQ-057: Command to trigger manual retention enforcement.
/// </summary>
public sealed record EnforceRetentionCommand : IRequest<int>;

public sealed record RetentionPolicyDto(
    Guid Id,
    string DataCategory,
    string DisplayName,
    int RetentionMonths,
    string Action,
    string? LegalBasis,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
)
{
    public static RetentionPolicyDto FromEntity(RetentionPolicy entity) => new(
        entity.Id,
        entity.DataCategory,
        entity.DisplayName,
        entity.RetentionMonths,
        entity.Action.ToString(),
        entity.LegalBasis,
        entity.IsActive,
        entity.CreatedAt,
        entity.UpdatedAt
    );
}

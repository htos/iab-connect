using MediatR;
using IabConnect.Domain.Operations;

namespace IabConnect.Application.Retention;

/// <summary>
/// REQ-057: Handles retention policy queries and commands.
/// </summary>
public sealed class GetRetentionPoliciesQueryHandler(IRetentionPolicyService policyService)
    : IRequestHandler<GetRetentionPoliciesQuery, List<RetentionPolicyDto>>
{
    public async Task<List<RetentionPolicyDto>> Handle(GetRetentionPoliciesQuery request, CancellationToken ct)
    {
        var policies = await policyService.GetAllPoliciesAsync(ct);
        return policies.Select(RetentionPolicyDto.FromEntity).ToList();
    }
}

public sealed class GetRetentionPolicyByIdQueryHandler(IRetentionPolicyService policyService)
    : IRequestHandler<GetRetentionPolicyByIdQuery, RetentionPolicyDto?>
{
    public async Task<RetentionPolicyDto?> Handle(GetRetentionPolicyByIdQuery request, CancellationToken ct)
    {
        var policy = await policyService.GetPolicyByIdAsync(request.Id, ct);
        return policy is null ? null : RetentionPolicyDto.FromEntity(policy);
    }
}

public sealed class UpdateRetentionPolicyCommandHandler(IRetentionPolicyService policyService)
    : IRequestHandler<UpdateRetentionPolicyCommand, RetentionPolicyDto?>
{
    public async Task<RetentionPolicyDto?> Handle(UpdateRetentionPolicyCommand request, CancellationToken ct)
    {
        var policy = await policyService.GetPolicyByIdAsync(request.Id, ct);
        if (policy is null) return null;

        if (!Enum.TryParse<RetentionAction>(request.Action, true, out var action))
            throw new ArgumentException($"Invalid retention action: {request.Action}");

        policy.Update(request.DisplayName, request.RetentionMonths, action, request.LegalBasis);

        if (request.IsActive)
            policy.Activate();
        else
            policy.Deactivate();

        await policyService.UpdatePolicyAsync(policy, ct);
        return RetentionPolicyDto.FromEntity(policy);
    }
}

public sealed class EnforceRetentionCommandHandler(IRetentionEnforcementService enforcementService)
    : IRequestHandler<EnforceRetentionCommand, int>
{
    public async Task<int> Handle(EnforceRetentionCommand request, CancellationToken ct)
    {
        return await enforcementService.EnforceAllPoliciesAsync(ct);
    }
}

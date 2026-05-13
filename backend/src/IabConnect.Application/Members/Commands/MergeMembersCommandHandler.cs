using MediatR;

namespace IabConnect.Application.Members.Commands;

/// <summary>
/// REQ-018 (E2.S3): MediatR handler for <see cref="MergeMembersCommand"/>. Thin wrapper that
/// delegates to <see cref="IMemberMergeService"/>; all transactional SQL lives in Infrastructure.
/// </summary>
public sealed class MergeMembersCommandHandler : IRequestHandler<MergeMembersCommand, MergeMembersResult>
{
    private readonly IMemberMergeService _mergeService;

    public MergeMembersCommandHandler(IMemberMergeService mergeService)
    {
        _mergeService = mergeService;
    }

    public Task<MergeMembersResult> Handle(MergeMembersCommand request, CancellationToken cancellationToken)
        => _mergeService.MergeAsync(request, cancellationToken);
}

using FluentValidation;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Commands;

/// <summary>
/// REQ-024 (E3.S3) AC-5/AC-6: Manager-driven assignment of a member to a shift.
/// Goes through <see cref="IEventVolunteerAssignmentService.AssignAsync"/> for the FOR UPDATE
/// row-lock + capacity decision protocol.
/// </summary>
public sealed record AssignVolunteerCommand(
    Guid EventId,
    Guid ShiftId,
    Guid MemberId,
    bool AllowWaitlistFallback,
    Guid AssignedBy) : IRequest<VolunteerAssignmentCommandResult>;

public sealed record VolunteerAssignmentCommandResult(
    VolunteerAssignmentOutcome Outcome,
    EventVolunteerAssignmentDto? Assignment);

public sealed class AssignVolunteerCommandValidator : AbstractValidator<AssignVolunteerCommand>
{
    public AssignVolunteerCommandValidator()
    {
        RuleFor(x => x.EventId).NotEqual(Guid.Empty);
        RuleFor(x => x.ShiftId).NotEqual(Guid.Empty);
        RuleFor(x => x.MemberId).NotEqual(Guid.Empty);
        RuleFor(x => x.AssignedBy).NotEqual(Guid.Empty);
    }
}

public sealed class AssignVolunteerCommandHandler
    : IRequestHandler<AssignVolunteerCommand, VolunteerAssignmentCommandResult>
{
    private readonly IEventVolunteerAssignmentService _service;
    private readonly IMemberRepository _members;

    public AssignVolunteerCommandHandler(
        IEventVolunteerAssignmentService service,
        IMemberRepository members)
    {
        _service = service;
        _members = members;
    }

    public async Task<VolunteerAssignmentCommandResult> Handle(
        AssignVolunteerCommand request,
        CancellationToken cancellationToken)
    {
        var result = await _service.AssignAsync(
            request.EventId, request.ShiftId, request.MemberId, request.AssignedBy,
            request.AllowWaitlistFallback, isSelfSignup: false, cancellationToken);

        if (result.Assignment is null)
            return new VolunteerAssignmentCommandResult(result.Outcome, null);

        var displayName = await ResolveDisplayNameAsync(result.Assignment.MemberId, cancellationToken);
        var dto = new EventVolunteerAssignmentDto(
            result.Assignment.Id,
            result.Assignment.ShiftId,
            result.Assignment.RoleId,
            result.Assignment.MemberId,
            displayName,
            result.Assignment.Status,
            result.Assignment.Position,
            result.Assignment.AssignedAt);

        return new VolunteerAssignmentCommandResult(result.Outcome, dto);
    }

    private async Task<string> ResolveDisplayNameAsync(Guid memberId, CancellationToken ct)
    {
        var member = await _members.GetByIdAsync(memberId, ct);
        return member is null ? "(unknown)" : $"{member.FirstName} {member.LastName}".Trim();
    }
}

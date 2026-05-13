using FluentValidation;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Commands;

/// <summary>
/// REQ-024 (E3.S3) AC-5: Member-driven self-signup. The handler resolves the calling user's
/// member id from <see cref="IMemberRepository.GetByKeycloakUserIdAsync"/> before delegating
/// to <see cref="IEventVolunteerAssignmentService.AssignAsync"/> with <c>isSelfSignup: true</c>.
/// </summary>
public sealed record SelfSignUpForVolunteerShiftCommand(
    Guid EventId,
    Guid ShiftId,
    Guid KeycloakUserId,
    bool AllowWaitlistFallback) : IRequest<VolunteerAssignmentCommandResult>;

public sealed class SelfSignUpForVolunteerShiftCommandValidator : AbstractValidator<SelfSignUpForVolunteerShiftCommand>
{
    public SelfSignUpForVolunteerShiftCommandValidator()
    {
        RuleFor(x => x.EventId).NotEqual(Guid.Empty);
        RuleFor(x => x.ShiftId).NotEqual(Guid.Empty);
        RuleFor(x => x.KeycloakUserId).NotEqual(Guid.Empty);
    }
}

public sealed class SelfSignUpForVolunteerShiftCommandHandler
    : IRequestHandler<SelfSignUpForVolunteerShiftCommand, VolunteerAssignmentCommandResult>
{
    private readonly IEventVolunteerAssignmentService _service;
    private readonly IMemberRepository _members;

    public SelfSignUpForVolunteerShiftCommandHandler(
        IEventVolunteerAssignmentService service,
        IMemberRepository members)
    {
        _service = service;
        _members = members;
    }

    public async Task<VolunteerAssignmentCommandResult> Handle(
        SelfSignUpForVolunteerShiftCommand request,
        CancellationToken cancellationToken)
    {
        var member = await _members.GetByKeycloakUserIdAsync(request.KeycloakUserId, cancellationToken)
            ?? throw new InvalidOperationException(
                "Calling user has no linked Member record; self-signup is not available.");

        var result = await _service.AssignAsync(
            request.EventId, request.ShiftId, member.Id, request.KeycloakUserId,
            request.AllowWaitlistFallback, isSelfSignup: true, cancellationToken);

        if (result.Assignment is null)
            return new VolunteerAssignmentCommandResult(result.Outcome, null);

        var dto = new EventVolunteerAssignmentDto(
            result.Assignment.Id,
            result.Assignment.ShiftId,
            result.Assignment.RoleId,
            result.Assignment.MemberId,
            $"{member.FirstName} {member.LastName}".Trim(),
            result.Assignment.Status,
            result.Assignment.Position,
            result.Assignment.AssignedAt);

        return new VolunteerAssignmentCommandResult(result.Outcome, dto);
    }
}

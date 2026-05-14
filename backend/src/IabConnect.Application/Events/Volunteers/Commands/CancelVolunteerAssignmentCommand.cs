using FluentValidation;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Commands;

/// <summary>
/// REQ-024 (E3.S3) AC-5: Cancels a single volunteer assignment.
///
/// <para><b>C1 (post-review authorization fix):</b> The endpoint passes the calling user's
/// Keycloak id + a staff-role flag; the handler resolves the caller's <c>Member</c> and the
/// service rejects with <see cref="VolunteerAssignmentOutcome.NotAuthorized"/> unless the
/// caller is the assignment owner OR holds an event-staff role.</para>
///
/// <para><b>H-S3-2 (cross-event tampering):</b> The route's <c>eventId</c> flows through the
/// command and the service asserts <c>shift.EventId == eventId</c> before mutating.</para>
/// </summary>
public sealed record CancelVolunteerAssignmentCommand(
    Guid EventId,
    Guid AssignmentId,
    string? Reason,
    Guid CallerKeycloakUserId,
    bool CallerIsStaff) : IRequest<VolunteerAssignmentCommandResult>;

public sealed class CancelVolunteerAssignmentCommandValidator : AbstractValidator<CancelVolunteerAssignmentCommand>
{
    public CancelVolunteerAssignmentCommandValidator()
    {
        RuleFor(x => x.EventId).NotEqual(Guid.Empty);
        RuleFor(x => x.AssignmentId).NotEqual(Guid.Empty);
        RuleFor(x => x.CallerKeycloakUserId).NotEqual(Guid.Empty);
        RuleFor(x => x.Reason).MaximumLength(EventVolunteerAssignment.CancellationReasonMaxLength);
    }
}

public sealed class CancelVolunteerAssignmentCommandHandler
    : IRequestHandler<CancelVolunteerAssignmentCommand, VolunteerAssignmentCommandResult>
{
    private readonly IEventVolunteerAssignmentService _service;
    private readonly IMemberRepository _members;

    public CancelVolunteerAssignmentCommandHandler(
        IEventVolunteerAssignmentService service,
        IMemberRepository members)
    {
        _service = service;
        _members = members;
    }

    public async Task<VolunteerAssignmentCommandResult> Handle(
        CancelVolunteerAssignmentCommand request,
        CancellationToken cancellationToken)
    {
        // C1: Resolve the calling user's Member id. Staff callers can act without one (they
        // may not have a Member record at all); members without a Member row cannot
        // cancel anyone — including their own — so we surface NotAuthorized.
        Guid? callerMemberId = null;
        if (!request.CallerIsStaff)
        {
            var caller = await _members.GetByKeycloakUserIdAsync(request.CallerKeycloakUserId, cancellationToken);
            if (caller is null)
            {
                return new VolunteerAssignmentCommandResult(VolunteerAssignmentOutcome.NotAuthorized, null);
            }
            // REQ-024 (E3.S3 Round-3 R3-H-S3-4): follow MergedIntoMemberId once so a soft-merged
            // member can still cancel assignments they signed up for under their pre-merge row.
            // Without this, a member who signed up for a shift and was later soft-merged into a
            // surviving Member would be permanently locked out of their own assignment
            // (caller.Id is the merged-source row; assignment.MemberId is the surviving target).
            // We compare against the SURVIVING member id so owner-check works across the merge.
            if (caller.MergedIntoMemberId.HasValue)
            {
                var surviving = await _members.GetByIdAsync(caller.MergedIntoMemberId.Value, cancellationToken);
                callerMemberId = surviving?.Id ?? caller.Id;
            }
            else
            {
                callerMemberId = caller.Id;
            }
        }

        var result = await _service.CancelAssignmentAsync(
            request.AssignmentId, request.Reason, request.EventId,
            callerMemberId, request.CallerIsStaff, cancellationToken);

        if (result.Assignment is null)
            return new VolunteerAssignmentCommandResult(result.Outcome, null);

        var member = await _members.GetByIdAsync(result.Assignment.MemberId, cancellationToken);
        var dto = new EventVolunteerAssignmentDto(
            result.Assignment.Id,
            result.Assignment.ShiftId,
            result.Assignment.RoleId,
            result.Assignment.MemberId,
            member is null ? "(unknown)" : $"{member.FirstName} {member.LastName}".Trim(),
            result.Assignment.Status,
            result.Assignment.Position,
            result.Assignment.AssignedAt);

        return new VolunteerAssignmentCommandResult(result.Outcome, dto);
    }
}

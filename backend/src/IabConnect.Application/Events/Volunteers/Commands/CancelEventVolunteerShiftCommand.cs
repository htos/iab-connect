using FluentValidation;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Commands;

/// <summary>
/// REQ-024 (E3.S3) AC-5: Cancels a volunteer shift. Post-review H-S3-2 — <see cref="EventId"/>
/// is now part of the command so the service can reject cross-event tampering. Post-review
/// H-S3-6 — the shift's <c>Status</c> is flipped to <see cref="IabConnect.Domain.Events.Volunteers.VolunteerShiftStatus.Cancelled"/>
/// inside the same transaction that cancels its assignments.
/// </summary>
public sealed record CancelEventVolunteerShiftCommand(
    Guid EventId,
    Guid ShiftId,
    string? Reason) : IRequest<CancelEventVolunteerShiftResult>;

public sealed record CancelEventVolunteerShiftResult(bool ShiftFound, int CancelledAssignmentCount);

public sealed class CancelEventVolunteerShiftCommandValidator : AbstractValidator<CancelEventVolunteerShiftCommand>
{
    public CancelEventVolunteerShiftCommandValidator()
    {
        RuleFor(x => x.EventId).NotEqual(Guid.Empty);
        RuleFor(x => x.ShiftId).NotEqual(Guid.Empty);
        RuleFor(x => x.Reason).MaximumLength(500);
    }
}

public sealed class CancelEventVolunteerShiftCommandHandler
    : IRequestHandler<CancelEventVolunteerShiftCommand, CancelEventVolunteerShiftResult>
{
    private readonly IEventVolunteerAssignmentService _service;

    public CancelEventVolunteerShiftCommandHandler(IEventVolunteerAssignmentService service)
    {
        _service = service;
    }

    public async Task<CancelEventVolunteerShiftResult> Handle(
        CancelEventVolunteerShiftCommand request,
        CancellationToken cancellationToken)
    {
        var result = await _service.CancelAllAssignmentsForShiftAsync(
            request.EventId, request.ShiftId, request.Reason, cancellationToken);
        return new CancelEventVolunteerShiftResult(result.ShiftFound, result.CancelledAssignmentCount);
    }
}

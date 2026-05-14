using FluentValidation;
using IabConnect.Domain.Events.Volunteers;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Commands;

/// <summary>
/// REQ-024 (E3.S3) AC-5: Updates a volunteer shift's details + capacity.
/// Post-review H-S3-2 / H-S3-5: <see cref="EventId"/> is now part of the command so the
/// handler asserts the shift belongs to the route's event; the capacity-change branch goes
/// through <see cref="IEventVolunteerAssignmentService.UpdateShiftCapacityAsync"/> which
/// takes a FOR UPDATE row lock before reading the confirmed count. Post-review M-S3-9: shift
/// <see cref="StartsAt"/> is rejected when in the past (with a 5-minute grace for clock skew).
/// Post-review M-S3-10: title may not be whitespace-only.
/// </summary>
public sealed record UpdateEventVolunteerShiftCommand(
    Guid EventId,
    Guid ShiftId,
    string Title,
    string? Description,
    DateTime StartsAt,
    DateTime EndsAt,
    int Capacity,
    bool AllowWaitlist,
    bool AllowSelfSignup,
    string? Notes) : IRequest<EventVolunteerShiftDto>;

public sealed class UpdateEventVolunteerShiftCommandValidator : AbstractValidator<UpdateEventVolunteerShiftCommand>
{
    /// <summary>5-minute clock-skew grace window for the past-shift guard (M-S3-9).</summary>
    internal static readonly TimeSpan ClockSkewGrace = TimeSpan.FromMinutes(5);

    public UpdateEventVolunteerShiftCommandValidator()
    {
        RuleFor(x => x.EventId).NotEqual(Guid.Empty);
        RuleFor(x => x.ShiftId).NotEqual(Guid.Empty);
        RuleFor(x => x.Title)
            .NotEmpty()
            .Must(t => !string.IsNullOrWhiteSpace(t))
                .WithMessage("Title is required.")
            .MaximumLength(EventVolunteerShift.TitleMaxLength);
        RuleFor(x => x.Description).MaximumLength(EventVolunteerShift.DescriptionMaxLength);
        RuleFor(x => x.Notes).MaximumLength(EventVolunteerShift.NotesMaxLength);
        RuleFor(x => x.Capacity).GreaterThanOrEqualTo(1);
        RuleFor(x => x).Must(x => x.EndsAt > x.StartsAt)
            .WithMessage("EndsAt must be greater than StartsAt.");
        RuleFor(x => x.StartsAt)
            .Must(t => t > DateTime.UtcNow - ClockSkewGrace)
            .WithMessage("StartsAt must not be in the past.");
    }
}

public sealed class UpdateEventVolunteerShiftCommandHandler
    : IRequestHandler<UpdateEventVolunteerShiftCommand, EventVolunteerShiftDto>
{
    private readonly IEventVolunteerShiftRepository _shifts;
    private readonly IEventVolunteerRoleRepository _roles;
    private readonly IEventVolunteerAssignmentRepository _assignments;
    private readonly IEventVolunteerAssignmentService _assignmentService;

    public UpdateEventVolunteerShiftCommandHandler(
        IEventVolunteerShiftRepository shifts,
        IEventVolunteerRoleRepository roles,
        IEventVolunteerAssignmentRepository assignments,
        IEventVolunteerAssignmentService assignmentService)
    {
        _shifts = shifts;
        _roles = roles;
        _assignments = assignments;
        _assignmentService = assignmentService;
    }

    public async Task<EventVolunteerShiftDto> Handle(UpdateEventVolunteerShiftCommand request, CancellationToken cancellationToken)
    {
        // REQ-024 (E3.S3 Round-3 R3-M-S3-1): route the entire update through the service so
        // capacity + field updates land inside a single FOR UPDATE transaction. The previous
        // two-phase implementation (capacity inside lock, fields after) left a TOCTOU window
        // for concurrent writers to overwrite the unlocked field update.
        var result = await _assignmentService.UpdateShiftAsync(
            request.EventId,
            request.ShiftId,
            request.Title,
            request.Description,
            request.StartsAt,
            request.EndsAt,
            request.Capacity,
            request.AllowWaitlist,
            request.AllowSelfSignup,
            request.Notes,
            cancellationToken);

        switch (result.Outcome)
        {
            case UpdateShiftCapacityOutcome.Updated:
                break;
            case UpdateShiftCapacityOutcome.ShiftNotFound:
                throw new KeyNotFoundException($"Shift {request.ShiftId} not found.");
            case UpdateShiftCapacityOutcome.BelowCurrentConfirmed:
                throw new InvalidOperationException(
                    $"Cannot reduce capacity below current confirmed count ({result.CurrentConfirmedCount}); cancel assignments first.");
            case UpdateShiftCapacityOutcome.InvalidCapacity:
                throw new InvalidOperationException("Capacity must be at least 1.");
        }

        // Re-load to project the post-update DTO (the service committed the transaction; the
        // entity in the DbContext change-tracker now reflects the persisted state).
        var shift = await _shifts.GetByIdAsync(request.ShiftId, cancellationToken)
            ?? throw new KeyNotFoundException($"Shift {request.ShiftId} not found.");

        var role = await _roles.GetByIdAsync(shift.RoleId, cancellationToken);
        var confirmedCount = await _assignments.CountConfirmedAsync(shift.Id, cancellationToken);
        var waitlistCount = await _assignments.CountWaitlistedAsync(shift.Id, cancellationToken);
        return EventVolunteerShiftDto.FromEntity(shift, role?.Name ?? string.Empty, confirmedCount, waitlistCount);
    }
}

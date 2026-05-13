using FluentValidation;
using IabConnect.Domain.Events.Volunteers;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Commands;

public sealed record CreateEventVolunteerShiftCommand(
    Guid EventId,
    Guid RoleId,
    string Title,
    string? Description,
    DateTime StartsAt,
    DateTime EndsAt,
    int Capacity,
    bool AllowWaitlist,
    bool AllowSelfSignup,
    string? Notes,
    Guid CreatedBy) : IRequest<EventVolunteerShiftDto>;

/// <summary>
/// REQ-024 (E3.S3) AC-5 validator. Post-review patches: M-S3-9 (no past <see cref="CreateEventVolunteerShiftCommand.StartsAt"/>),
/// M-S3-10 (whitespace-only title rejected, not propagated to the domain factory as a 500).
/// </summary>
public sealed class CreateEventVolunteerShiftCommandValidator : AbstractValidator<CreateEventVolunteerShiftCommand>
{
    internal static readonly TimeSpan ClockSkewGrace = TimeSpan.FromMinutes(5);

    public CreateEventVolunteerShiftCommandValidator()
    {
        RuleFor(x => x.EventId).NotEqual(Guid.Empty);
        RuleFor(x => x.RoleId).NotEqual(Guid.Empty);
        RuleFor(x => x.CreatedBy).NotEqual(Guid.Empty);
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

public sealed class CreateEventVolunteerShiftCommandHandler
    : IRequestHandler<CreateEventVolunteerShiftCommand, EventVolunteerShiftDto>
{
    private readonly IEventVolunteerShiftRepository _shifts;
    private readonly IEventVolunteerRoleRepository _roles;

    public CreateEventVolunteerShiftCommandHandler(
        IEventVolunteerShiftRepository shifts,
        IEventVolunteerRoleRepository roles)
    {
        _shifts = shifts;
        _roles = roles;
    }

    public async Task<EventVolunteerShiftDto> Handle(CreateEventVolunteerShiftCommand request, CancellationToken cancellationToken)
    {
        var role = await _roles.GetByIdAsync(request.RoleId, cancellationToken)
            ?? throw new KeyNotFoundException($"Role {request.RoleId} not found.");
        if (role.EventId != request.EventId)
            throw new InvalidOperationException("Role does not belong to the specified event.");

        // M-S3-8: shifts MUST NOT be created against a deactivated role.
        if (!role.IsActive)
            throw new InvalidOperationException(
                $"Role '{role.Name}' is deactivated; reactivate it before creating new shifts.");

        var shift = EventVolunteerShift.Create(
            request.EventId, request.RoleId, request.Title, request.Description,
            request.StartsAt, request.EndsAt, request.Capacity,
            request.AllowWaitlist, request.AllowSelfSignup, request.CreatedBy, request.Notes);

        await _shifts.AddAsync(shift, cancellationToken);

        return EventVolunteerShiftDto.FromEntity(shift, role.Name, confirmedCount: 0, waitlistCount: 0);
    }
}

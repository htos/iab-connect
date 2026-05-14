using FluentValidation;
using IabConnect.Domain.Events.Volunteers;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Commands;

/// <summary>
/// REQ-024 (E3.S3 Round-3 R3-C2): added <see cref="EventId"/> to close a cross-event IDOR.
/// The previous shape relied solely on <see cref="RoleId"/>, so an <c>event-manager</c> for
/// event A could <c>PUT /api/v1/events/{eventA}/volunteer-roles/{eventB.someRoleId}</c> and
/// rename / deactivate a role in event B. The handler now asserts
/// <c>role.EventId == request.EventId</c> before any mutation — mismatch returns a
/// <see cref="KeyNotFoundException"/> (mapped to 404, identical to "role does not exist" so
/// the response is opaque to enumeration probes).
/// </summary>
public sealed record UpdateEventVolunteerRoleCommand(
    Guid EventId,
    Guid RoleId,
    string Name,
    string? Description,
    bool IsActive) : IRequest<EventVolunteerRoleDto>;

public sealed class UpdateEventVolunteerRoleCommandValidator : AbstractValidator<UpdateEventVolunteerRoleCommand>
{
    public UpdateEventVolunteerRoleCommandValidator()
    {
        RuleFor(x => x.EventId).NotEqual(Guid.Empty);
        RuleFor(x => x.RoleId).NotEqual(Guid.Empty);
        RuleFor(x => x.Name)
            .NotEmpty()
            .Must(n => !string.IsNullOrWhiteSpace(n))
                .WithMessage("Name is required.")
            .MaximumLength(EventVolunteerRole.NameMaxLength);
        RuleFor(x => x.Description).MaximumLength(EventVolunteerRole.DescriptionMaxLength);
    }
}

public sealed class UpdateEventVolunteerRoleCommandHandler
    : IRequestHandler<UpdateEventVolunteerRoleCommand, EventVolunteerRoleDto>
{
    private readonly IEventVolunteerRoleRepository _roles;

    public UpdateEventVolunteerRoleCommandHandler(IEventVolunteerRoleRepository roles)
    {
        _roles = roles;
    }

    public async Task<EventVolunteerRoleDto> Handle(UpdateEventVolunteerRoleCommand request, CancellationToken cancellationToken)
    {
        var role = await _roles.GetByIdAsync(request.RoleId, cancellationToken)
            ?? throw new KeyNotFoundException($"Role {request.RoleId} not found.");

        // R3-C2: opaque 404 on cross-event tampering — identical message to "role does not exist".
        if (role.EventId != request.EventId)
            throw new KeyNotFoundException($"Role {request.RoleId} not found.");

        role.Rename(request.Name);
        role.UpdateDescription(request.Description);
        if (request.IsActive) role.Activate(); else role.Deactivate();

        try
        {
            await _roles.UpdateAsync(role, cancellationToken);
        }
        catch (VolunteerRoleNameConflictException ex)
        {
            // M-S3-7: rename collision must surface as a 409 (symmetric with Create), not a 500.
            throw new InvalidOperationException(ex.Message);
        }
        return EventVolunteerRoleDto.FromEntity(role);
    }
}

using FluentValidation;
using IabConnect.Domain.Events.Volunteers;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Commands;

public sealed record UpdateEventVolunteerRoleCommand(
    Guid RoleId,
    string Name,
    string? Description,
    bool IsActive) : IRequest<EventVolunteerRoleDto>;

public sealed class UpdateEventVolunteerRoleCommandValidator : AbstractValidator<UpdateEventVolunteerRoleCommand>
{
    public UpdateEventVolunteerRoleCommandValidator()
    {
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

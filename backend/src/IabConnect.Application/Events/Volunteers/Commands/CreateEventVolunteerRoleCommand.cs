using FluentValidation;
using IabConnect.Domain.Events.Volunteers;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Commands;

public sealed record CreateEventVolunteerRoleCommand(
    Guid EventId,
    string Name,
    string? Description,
    Guid CreatedBy) : IRequest<EventVolunteerRoleDto>;

/// <summary>
/// REQ-024 (E3.S3) validator. Post-review M-S3-10: whitespace-only name is rejected
/// here instead of bubbling an <see cref="ArgumentException"/> from the domain factory.
/// </summary>
public sealed class CreateEventVolunteerRoleCommandValidator : AbstractValidator<CreateEventVolunteerRoleCommand>
{
    public CreateEventVolunteerRoleCommandValidator()
    {
        RuleFor(x => x.EventId).NotEqual(Guid.Empty);
        RuleFor(x => x.CreatedBy).NotEqual(Guid.Empty);
        RuleFor(x => x.Name)
            .NotEmpty()
            .Must(n => !string.IsNullOrWhiteSpace(n))
                .WithMessage("Name is required.")
            .MaximumLength(EventVolunteerRole.NameMaxLength);
        RuleFor(x => x.Description).MaximumLength(EventVolunteerRole.DescriptionMaxLength);
    }
}

public sealed class CreateEventVolunteerRoleCommandHandler
    : IRequestHandler<CreateEventVolunteerRoleCommand, EventVolunteerRoleDto>
{
    private readonly IEventVolunteerRoleRepository _roles;

    public CreateEventVolunteerRoleCommandHandler(IEventVolunteerRoleRepository roles)
    {
        _roles = roles;
    }

    public async Task<EventVolunteerRoleDto> Handle(CreateEventVolunteerRoleCommand request, CancellationToken cancellationToken)
    {
        var existing = await _roles.GetByEventAndNameAsync(request.EventId, request.Name, cancellationToken);
        if (existing is not null)
            throw new InvalidOperationException($"A role named '{request.Name}' already exists for this event.");

        var role = EventVolunteerRole.Create(request.EventId, request.Name, request.Description, request.CreatedBy);
        try
        {
            await _roles.AddAsync(role, cancellationToken);
        }
        catch (VolunteerRoleNameConflictException ex)
        {
            // M-S3-1: pre-check vs insert is not atomic; if a concurrent caller wins the race
            // the repository translates 23505 → VolunteerRoleNameConflictException and we
            // surface the same domain-meaningful 409 instead of a 500.
            throw new InvalidOperationException(ex.Message);
        }
        return EventVolunteerRoleDto.FromEntity(role);
    }
}

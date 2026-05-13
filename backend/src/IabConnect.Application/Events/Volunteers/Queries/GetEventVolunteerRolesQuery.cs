using IabConnect.Domain.Events.Volunteers;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Queries;

public sealed record GetEventVolunteerRolesQuery(Guid EventId) : IRequest<IReadOnlyList<EventVolunteerRoleDto>>;

public sealed class GetEventVolunteerRolesQueryHandler
    : IRequestHandler<GetEventVolunteerRolesQuery, IReadOnlyList<EventVolunteerRoleDto>>
{
    private readonly IEventVolunteerRoleRepository _roles;

    public GetEventVolunteerRolesQueryHandler(IEventVolunteerRoleRepository roles)
    {
        _roles = roles;
    }

    public async Task<IReadOnlyList<EventVolunteerRoleDto>> Handle(
        GetEventVolunteerRolesQuery request,
        CancellationToken cancellationToken)
    {
        var entities = await _roles.GetByEventIdAsync(request.EventId, cancellationToken);
        return entities.Select(EventVolunteerRoleDto.FromEntity).ToList();
    }
}

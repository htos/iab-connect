using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Commands;

/// <summary>
/// REQ-068: Command to soft-delete an activity area
/// </summary>
public sealed record DeleteActivityAreaCommand(Guid Id) : IRequest<bool>;

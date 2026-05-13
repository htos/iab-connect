using MediatR;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): MediatR handler for <see cref="ManualCheckInRegistrationCommand"/>.
/// Delegates the transactional check-in to <see cref="IEventRegistrationCheckInService"/> so
/// the manual-search path shares the exact same FOR-UPDATE concurrency contract as the
/// QR and ID paths (Symmetric-Guard checklist — action A2).
/// </summary>
public sealed class ManualCheckInRegistrationCommandHandler
    : IRequestHandler<ManualCheckInRegistrationCommand, CheckInResultDto>
{
    private readonly IEventRegistrationCheckInService _service;

    public ManualCheckInRegistrationCommandHandler(IEventRegistrationCheckInService service)
    {
        _service = service;
    }

    public Task<CheckInResultDto> Handle(ManualCheckInRegistrationCommand request, CancellationToken cancellationToken) =>
        _service.CheckInByIdAsync(request.EventId, request.RegistrationId, request.CheckedInBy, cancellationToken);
}

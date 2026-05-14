using IabConnect.Application.Authorization;
using MediatR;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): MediatR handler for <see cref="ManualCheckInRegistrationCommand"/>.
/// Delegates the transactional check-in to <see cref="IEventRegistrationCheckInService"/> so
/// the manual-search path shares the exact same FOR-UPDATE concurrency contract as the
/// QR and ID paths (Symmetric-Guard checklist — action A2).
///
/// <para>REQ-023 (E3.S2 Round-3 R3-DN-3): writes the <c>EventCheckInManual</c> audit verb on a
/// successful state change. The (optional) <see cref="ManualCheckInRegistrationCommand.SearchQueryHash"/>
/// from the command is included in <c>additionalData</c> so the audit row reflects the staff's
/// lookup term without persisting raw search PII.</para>
/// </summary>
public sealed class ManualCheckInRegistrationCommandHandler
    : IRequestHandler<ManualCheckInRegistrationCommand, CheckInResultDto>
{
    private readonly IEventRegistrationCheckInService _service;
    private readonly ISecurityAuditLogger _auditLogger;

    public ManualCheckInRegistrationCommandHandler(
        IEventRegistrationCheckInService service,
        ISecurityAuditLogger auditLogger)
    {
        _service = service;
        _auditLogger = auditLogger;
    }

    public async Task<CheckInResultDto> Handle(ManualCheckInRegistrationCommand request, CancellationToken cancellationToken)
    {
        var result = await _service.CheckInByIdAsync(
            request.EventId,
            request.RegistrationId,
            request.CheckedInBy,
            cancellationToken);

        if (result.Outcome == CheckInOutcome.CheckedIn && result.Registration is not null)
        {
            var additionalData = new Dictionary<string, object>
            {
                ["eventId"] = result.Registration.EventId,
                ["wasAlreadyCheckedIn"] = false,
            };
            if (!string.IsNullOrEmpty(request.SearchQueryHash))
                additionalData["searchQueryHash"] = request.SearchQueryHash;

            _auditLogger.LogAccessGranted(
                request.User,
                resource: "EventRegistration",
                action: "EventCheckInManual",
                resourceId: result.Registration.Id.ToString(),
                additionalData: additionalData);
        }

        return result;
    }
}

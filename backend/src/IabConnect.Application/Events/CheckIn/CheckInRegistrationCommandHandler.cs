using IabConnect.Application.Authorization;
using MediatR;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): MediatR handler for <see cref="CheckInRegistrationCommand"/>.
/// Routes on the non-null discriminator and delegates the FOR-UPDATE row-locked,
/// transactional check-in to <see cref="IEventRegistrationCheckInService"/>.
///
/// <para>Mirrors the <see cref="IabConnect.Application.Members.Commands.MergeMembersCommandHandler"/>
/// pattern — handler stays thin, SQL/transaction lives in Infrastructure.</para>
///
/// <para>REQ-023 (E3.S2 Round-3 R3-DN-3): audit logging moved here from the endpoint. The
/// handler picks the correct audit verb (<c>EventCheckInScanned</c> for the QR path,
/// <c>EventCheckInById</c> for the ID path) and writes <see cref="ISecurityAuditLogger.LogAccessGranted"/>
/// ONLY when the outcome is a real state change (<see cref="CheckInOutcome.CheckedIn"/>).
/// Idempotent already-checked-in returns produce no audit row. Centralising audit in the
/// handler means future internal callers (background command dispatchers, integration tests
/// that bypass HTTP) also produce an audit trail — fixing the previous coverage gap.</para>
/// </summary>
public sealed class CheckInRegistrationCommandHandler
    : IRequestHandler<CheckInRegistrationCommand, CheckInResultDto>
{
    private readonly IEventRegistrationCheckInService _service;
    private readonly ISecurityAuditLogger _auditLogger;

    public CheckInRegistrationCommandHandler(
        IEventRegistrationCheckInService service,
        ISecurityAuditLogger auditLogger)
    {
        _service = service;
        _auditLogger = auditLogger;
    }

    public async Task<CheckInResultDto> Handle(CheckInRegistrationCommand request, CancellationToken cancellationToken)
    {
        var isQrPath = !string.IsNullOrWhiteSpace(request.QrCodeToken);

        var result = isQrPath
            ? await _service.CheckInByQrCodeAsync(request.QrCodeToken!, request.CheckedInBy, cancellationToken)
            // Validator guarantees RegistrationId is non-null on the ID path.
            : await _service.CheckInByIdAsync(
                request.EventId,
                request.RegistrationId!.Value,
                request.CheckedInBy,
                cancellationToken);

        if (result.Outcome == CheckInOutcome.CheckedIn && result.Registration is not null)
        {
            _auditLogger.LogAccessGranted(
                request.User,
                resource: "EventRegistration",
                action: isQrPath ? "EventCheckInScanned" : "EventCheckInById",
                resourceId: result.Registration.Id.ToString(),
                additionalData: new Dictionary<string, object>
                {
                    ["eventId"] = result.Registration.EventId,
                    ["wasAlreadyCheckedIn"] = false,
                });
        }

        return result;
    }
}

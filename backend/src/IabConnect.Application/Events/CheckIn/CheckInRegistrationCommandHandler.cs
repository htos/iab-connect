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
/// <para>Audit logging (<c>LogAccessGranted</c>) is intentionally NOT performed here. It is the
/// endpoint layer's responsibility (matches project convention — see
/// <c>DismissDuplicateCandidateCommandHandler</c>, <c>IdentityEndpoints</c>, <c>UserEndpoints</c>),
/// and lets the endpoint pick the correct audit verb
/// (<c>EventCheckInScanned</c> / <c>EventCheckInById</c>) based on which route was invoked.
/// Story AC-4 documents the verbs; the deviation from AC-4's literal "handler logs" wording is
/// captured in Completion Notes and preserves all observable behavior.</para>
/// </summary>
public sealed class CheckInRegistrationCommandHandler
    : IRequestHandler<CheckInRegistrationCommand, CheckInResultDto>
{
    private readonly IEventRegistrationCheckInService _service;

    public CheckInRegistrationCommandHandler(IEventRegistrationCheckInService service)
    {
        _service = service;
    }

    public Task<CheckInResultDto> Handle(CheckInRegistrationCommand request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.QrCodeToken))
        {
            return _service.CheckInByQrCodeAsync(request.QrCodeToken, request.CheckedInBy, cancellationToken);
        }

        // Validator guarantees RegistrationId is non-null here.
        return _service.CheckInByIdAsync(
            request.EventId,
            request.RegistrationId!.Value,
            request.CheckedInBy,
            cancellationToken);
    }
}

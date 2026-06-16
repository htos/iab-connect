using MediatR;

namespace IabConnect.Application.Integration.Commands;

/// <summary>
/// REQ-058 (E8-S1): create a named API credential with a granted scope set. The response carries
/// the cleartext secret exactly once.
/// </summary>
public sealed record CreateApiClientCommand : IRequest<ApiClientCreatedDto>
{
    public required string Name { get; init; }
    public required IReadOnlyCollection<string> Scopes { get; init; }
}

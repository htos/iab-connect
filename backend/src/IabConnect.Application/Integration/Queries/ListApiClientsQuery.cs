using IabConnect.Domain.Integration;
using MediatR;

namespace IabConnect.Application.Integration.Queries;

/// <summary>REQ-058 (E8-S1, AC-1): list all credentials for the admin surface. Never returns the secret/hash.</summary>
public sealed record ListApiClientsQuery : IRequest<IReadOnlyList<ApiClientDto>>;

public sealed class ListApiClientsQueryHandler : IRequestHandler<ListApiClientsQuery, IReadOnlyList<ApiClientDto>>
{
    private readonly IApiClientRepository _repository;

    public ListApiClientsQueryHandler(IApiClientRepository repository)
    {
        _repository = repository;
    }

    public async Task<IReadOnlyList<ApiClientDto>> Handle(ListApiClientsQuery request, CancellationToken ct)
    {
        var clients = await _repository.GetAllAsync(ct);
        return clients.Select(ApiClientDto.FromEntity).ToList();
    }
}

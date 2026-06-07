using IabConnect.Application.Integration;
using IabConnect.Application.Integration.Commands;
using IabConnect.Application.Integration.Queries;
using IabConnect.Domain.Integration;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-058 (E8-S1): admin endpoints for external API credential management. Templated on
/// <c>CustomRoleEndpoints</c> — an admin-only group that dispatches MediatR commands/queries.
///
/// <para><b>Self-lockout rule:</b> this admin group is gated by <c>RequireAdmin</c> only and is
/// deliberately NOT behind <c>Module:api</c> — disabling the integration module must never lock an
/// admin out of managing (or re-enabling) credentials. Only the external consumer routes (E8-S2/S3)
/// carry the module gate.</para>
/// </summary>
public static class ApiClientEndpoints
{
    public static void MapApiClientEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/api-clients")
            .WithTags("Integration - API Clients")
            .RequireAuthorization("RequireAdmin");

        group.MapGet("/", ListApiClients).WithName("ListApiClients");
        group.MapGet("/scopes", GetScopes).WithName("GetApiScopes");
        group.MapPost("/", CreateApiClient).WithName("CreateApiClient");
        group.MapPost("/{id:guid}/revoke", RevokeApiClient).WithName("RevokeApiClient");
    }

    private static async Task<IResult> ListApiClients(ISender sender, CancellationToken ct)
    {
        var result = await sender.Send(new ListApiClientsQuery(), ct);
        return Results.Ok(result);
    }

    /// <summary>Returns the closed set of grantable scopes — drives the create-dialog checkboxes.</summary>
    private static IResult GetScopes() => Results.Ok(ApiScopes.All);

    private static async Task<IResult> CreateApiClient(
        CreateApiClientRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateApiClientCommand
        {
            Name = request.Name,
            Scopes = request.Scopes ?? []
        }, ct);
        // The response carries the cleartext secret exactly once.
        return Results.Created($"/api/v1/admin/api-clients/{dto.Id}", dto);
    }

    private static async Task<IResult> RevokeApiClient(Guid id, ISender sender, CancellationToken ct)
    {
        var found = await sender.Send(new RevokeApiClientCommand(id), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "API client not found." });
    }
}

/// <summary>REQ-058 (E8-S1): create-credential request body.</summary>
public sealed record CreateApiClientRequest(string Name, IReadOnlyCollection<string>? Scopes);

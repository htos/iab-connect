using IabConnect.Application.Audit;
using IabConnect.Application.Communication.Messaging;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-030 (E5-S5): self-service channel-preference API, co-located with the consent surface under
/// <c>/api/v1/privacy/channel-preferences</c> (DEC-4). Self-scoped to the current user (the `sub`
/// claim) — a user can only read/write their own preference (ADR-003; UI is not the boundary).
/// </summary>
public static class ChannelPreferenceEndpoints
{
    public static void MapChannelPreferenceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/privacy/channel-preferences")
            .WithTags("Privacy")
            .RequireAuthorization("RequireMember"); // self-service; current user only

        group.MapGet("/", GetPreference).WithName("GetChannelPreference");
        group.MapPut("/", UpdatePreference).WithName("UpdateChannelPreference");
    }

    private static async Task<IResult> GetPreference(
        HttpContext httpContext,
        IUserChannelPreferenceRepository repository,
        IEnumerable<IMessageChannelSender> senders,
        CancellationToken ct)
    {
        var userId = GetUserId(httpContext);
        if (userId is null)
            return Results.Unauthorized();

        var pref = await repository.GetByUserIdAsync(userId.Value, ct);
        var available = senders
            .Select(s => new ChannelAvailabilityDto(s.Channel.ToString(), s.IsEnabled))
            .OrderBy(c => c.Channel)
            .ToList();

        return Results.Ok(new ChannelPreferenceDto(
            pref?.PreferredChannel ?? UserChannelPreference.DefaultChannel,
            available));
    }

    private static async Task<IResult> UpdatePreference(
        HttpContext httpContext,
        UpdateChannelPreferenceRequest request,
        IUserChannelPreferenceRepository repository,
        IAuditService auditService,
        CancellationToken ct)
    {
        var userId = GetUserId(httpContext);
        if (userId is null)
            return Results.Unauthorized();

        // DEC-5: a preference may be stored for any KNOWN channel (the user can pre-set SMS before
        // the Verein enables it); eligibility gates the actual send. Reject only unknown channels.
        if (string.IsNullOrWhiteSpace(request.PreferredChannel)
            || !Enum.TryParse<MessageChannel>(request.PreferredChannel, ignoreCase: false, out _))
        {
            return Results.BadRequest(new
            {
                title = "Validation Failed",
                status = 400,
                errors = new { PreferredChannel = new[] { "Unknown channel. Expected one of: Email, Sms, WhatsApp." } }
            });
        }

        var preference = UserChannelPreference.Create(userId.Value, request.PreferredChannel);
        await repository.UpsertAsync(preference, ct);

        await auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            $"Channel preference set to {request.PreferredChannel}",
            entityType: "UserChannelPreference",
            entityId: userId.Value.ToString(),
            ct: ct);

        return Results.Ok(new { preferredChannel = request.PreferredChannel });
    }

    private static Guid? GetUserId(HttpContext httpContext)
    {
        var sub = httpContext.User.FindFirst("sub")?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}

public sealed record ChannelAvailabilityDto(string Channel, bool IsEnabled);

public sealed record ChannelPreferenceDto(string PreferredChannel, IReadOnlyList<ChannelAvailabilityDto> AvailableChannels);

public sealed record UpdateChannelPreferenceRequest(string PreferredChannel);

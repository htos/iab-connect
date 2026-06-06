using System.Net;
using System.Security.Claims;
using FluentAssertions;
using IabConnect.Api.Endpoints;
using IabConnect.Application.Authorization;
using IabConnect.Application.Common;
using IabConnect.Application.Events;
using IabConnect.Application.Events.CheckIn;
using IabConnect.Application.Events.PaidRegistration;
using IabConnect.Domain.Events;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-023: API-layer tests for the check-in roster + CSV export endpoints.
/// Verifies endpoint-metadata authorization wiring (RequireEventStaff policy
/// applied to BOTH new endpoints) AND the runtime unauthenticated → 401 behaviour.
///
/// Runtime tests share <see cref="TestWebApplicationFactory"/> via the <c>Api</c>
/// collection (A15, Epic-3-Retro): a single factory instance per test run sidesteps
/// the Serilog frozen-logger collision that a second <c>WebApplicationFactory&lt;Program&gt;</c>
/// boot would trip.
/// </summary>
[Collection("Api")]
public sealed class EventCheckInRosterEndpointTests
{
    private readonly TestWebApplicationFactory _factory;

    public EventCheckInRosterEndpointTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("/api/v1/events/{0}/registrations/check-in-roster")]
    [InlineData("/api/v1/events/{0}/registrations/check-in-roster/export.csv")]
    public async Task CheckInRosterEndpoints_Unauthenticated_Returns401(string routeTemplate)
    {
        var client = _factory.CreateClient();
        var url = string.Format(routeTemplate, Guid.NewGuid());

        var response = await client.GetAsync(url, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("/api/v1/events/{eventId:guid}/registrations/check-in-roster")]
    [InlineData("/api/v1/events/{eventId:guid}/registrations/check-in-roster/export.csv")]
    public void CheckInRosterEndpoints_ShouldRequireEventStaffPolicy(string routePattern)
    {
        var endpoint = ResolveEndpoint(routePattern);

        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();
        authorizeData.Should().Contain(data => data.Policy == "RequireEventStaff");
    }

    [Theory]
    [InlineData("/api/v1/events/{eventId:guid}/registrations/check-in-roster")]
    [InlineData("/api/v1/events/{eventId:guid}/registrations/check-in-roster/export.csv")]
    public void CheckInRosterEndpoints_ShouldRequireAuthentication(string routePattern)
    {
        var endpoint = ResolveEndpoint(routePattern);

        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();
        // The group-level `RequireAuthorization()` adds a default-policy entry
        // (no Policy/Roles/AuthenticationSchemes set). Its presence guarantees
        // unauthenticated callers cannot reach the handler.
        authorizeData.Should().Contain(data =>
            string.IsNullOrEmpty(data.Policy)
            && string.IsNullOrEmpty(data.Roles)
            && string.IsNullOrEmpty(data.AuthenticationSchemes));
    }

    private static RouteEndpoint ResolveEndpoint(string routePattern)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("RequireEventStaff", policy =>
                policy.RequireRole("admin", "vorstand", "event-manager"));

        builder.Services.AddSingleton<IEventRepository, FakeEventRepository>();
        builder.Services.AddSingleton<IEventRegistrationRepository, FakeEventRegistrationRepository>();
        builder.Services.AddSingleton<IEventNotificationService, FakeEventNotificationService>();
        builder.Services.AddSingleton<IRegistrationPdfExporter, FakeRegistrationPdfExporter>();
        builder.Services.AddSingleton<IEventCheckInRosterCsvExporter, FakeCsvExporter>();
        builder.Services.AddSingleton<ISender, FakeSender>();
        // E3.S2: the new check-in endpoints sharing this Map call need an audit logger
        builder.Services.AddSingleton<ISecurityAuditLogger, FakeSecurityAuditLogger>();
        // H-S2-5 (Epic-3-retro §9): the CancelRegistration endpoint in this Map call now
        // depends on the transactional cancellation service.
        builder.Services.AddSingleton<IEventRegistrationCancellationService, FakeEventRegistrationCancellationService>();
        // REQ-022 (E4-S2): register handlers also take these services for the paid branch.
        builder.Services.AddSingleton(Moq.Mock.Of<IEventFeeCategoryRepository>());
        builder.Services.AddSingleton(Moq.Mock.Of<IModuleSettingsService>());
        builder.Services.AddSingleton(Moq.Mock.Of<IPaidRegistrationService>());
        builder.Services.AddSingleton(Moq.Mock.Of<IabConnect.Application.Finance.IInvoiceRepository>());
        builder.Services.AddSingleton(Moq.Mock.Of<IabConnect.Application.Finance.IFinanceProfileRepository>());
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase($"checkin-roster-{routePattern}"));

        var app = builder.Build();
        app.MapEventRegistrationEndpoints();

        return ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(dataSource => dataSource.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(route => route.RoutePattern.RawText == routePattern);
    }

    private sealed class FakeEventRepository : IEventRepository
    {
        public Task<Event?> GetByIdAsync(Guid id, CancellationToken ct = default) => Task.FromResult<Event?>(null);
        public Task<IReadOnlyList<Event>> GetAllAsync(CancellationToken ct = default) => Task.FromResult<IReadOnlyList<Event>>(Array.Empty<Event>());
        public Task<(IReadOnlyList<Event> Items, int TotalCount)> GetPagedAsync(EventFilterOptions filter, int page = 1, int pageSize = 20, CancellationToken ct = default) => Task.FromResult<(IReadOnlyList<Event>, int)>((Array.Empty<Event>(), 0));
        public Task<IReadOnlyList<Event>> GetUpcomingAsync(int count = 10, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<Event>>(Array.Empty<Event>());
        public Task<IReadOnlyList<Event>> GetByOrganizerAsync(Guid organizerId, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<Event>>(Array.Empty<Event>());
        public Task<IReadOnlyList<Event>> GetByDateRangeAsync(DateTime start, DateTime end, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<Event>>(Array.Empty<Event>());
        public Task<IReadOnlyList<Event>> GetPublicEventsAsync(DateTime? from = null, DateTime? to = null, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<Event>>(Array.Empty<Event>());
        public Task<bool> ExistsAsync(Guid id, CancellationToken ct = default) => Task.FromResult(false);
        public Task<int> GetCountAsync(EventFilterOptions? filter = null, CancellationToken ct = default) => Task.FromResult(0);
        public Task AddAsync(Event evt, CancellationToken ct = default) => Task.CompletedTask;
        public void Update(Event evt) { }
        public void Remove(Event evt) { }
    }

    private sealed class FakeEventRegistrationRepository : IEventRegistrationRepository
    {
        public Task AddAsync(EventRegistration registration, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task UpdateAsync(EventRegistration registration, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<EventRegistration?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<EventRegistration?>(null);
        public Task<EventRegistration?> GetByQrCodeTokenAsync(string qrCodeToken, CancellationToken cancellationToken = default) => Task.FromResult<EventRegistration?>(null);
        public Task<IReadOnlyList<EventRegistration>> GetByEventIdAsync(Guid eventId, EventRegistrationFilterOptions? filter = null, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<EventRegistration>>(Array.Empty<EventRegistration>());
        public Task<IReadOnlyList<EventRegistration>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<EventRegistration>>(Array.Empty<EventRegistration>());
        public Task<IReadOnlyList<EventRegistration>> GetByMemberIdAsync(Guid memberId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<EventRegistration>>(Array.Empty<EventRegistration>());
        public Task<bool> ExistsAsync(Guid eventId, Guid userId, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task<bool> ExistsByEmailAsync(Guid eventId, string email, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task<int> CountConfirmedAsync(Guid eventId, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<int> CountTotalParticipantsAsync(Guid eventId, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<int> CountWaitlistedAsync(Guid eventId, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<IReadOnlyList<EventRegistration>> GetWaitlistAsync(Guid eventId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<EventRegistration>>(Array.Empty<EventRegistration>());
        public Task<EventRegistration?> GetNextOnWaitlistAsync(Guid eventId, CancellationToken cancellationToken = default) => Task.FromResult<EventRegistration?>(null);
        public Task<EventRegistrationStatistics> GetStatisticsAsync(Guid eventId, CancellationToken cancellationToken = default) => Task.FromResult(new EventRegistrationStatistics());
        public Task<(IReadOnlyList<EventRegistration> Items, int TotalCount)> GetPagedAsync(Guid eventId, EventRegistrationFilterOptions? filter, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default) => Task.FromResult<(IReadOnlyList<EventRegistration>, int)>((Array.Empty<EventRegistration>(), 0));
    }

    private sealed class FakeEventNotificationService : IEventNotificationService
    {
        public Task SendRegistrationConfirmationAsync(EventRegistration registration, Event evt, CancellationToken ct = default) => Task.CompletedTask;
        public Task SendWaitlistConfirmationAsync(EventRegistration registration, Event evt, CancellationToken ct = default) => Task.CompletedTask;
        public Task SendWaitlistPromotionAsync(EventRegistration registration, Event evt, CancellationToken ct = default) => Task.CompletedTask;
        public Task SendCancellationNotificationAsync(EventRegistration registration, Event evt, CancellationToken ct = default) => Task.CompletedTask;
        public Task SendVolunteerShiftReminderAsync(EventVolunteerAssignment assignment, EventVolunteerShift shift, EventVolunteerRole role, Event evt, Member member, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class FakeRegistrationPdfExporter : IRegistrationPdfExporter
    {
        public Task<byte[]> GenerateRegistrationListPdfAsync(Event evt, IReadOnlyList<EventRegistration> registrations, EventRegistrationStatistics statistics)
            => Task.FromResult(Array.Empty<byte>());
    }

    private sealed class FakeEventRegistrationCancellationService : IEventRegistrationCancellationService
    {
        public Task<CancelRegistrationResult> CancelAsync(Guid eventId, Guid registrationId, string? reason, bool cancelledByParticipant, CancellationToken cancellationToken = default)
            => Task.FromResult(CancelRegistrationResult.NotFound());
    }

    private sealed class FakeCsvExporter : IEventCheckInRosterCsvExporter
    {
        public byte[] Export(EventCheckInRosterDto roster) => Array.Empty<byte>();
    }

    private sealed class FakeSecurityAuditLogger : ISecurityAuditLogger
    {
        public void LogAccessDenied(ClaimsPrincipal user, string resource, string action, string reason, string? resourceId = null, IDictionary<string, object>? additionalData = null) { }
        public void LogAccessGranted(ClaimsPrincipal user, string resource, string action, string? resourceId = null, IDictionary<string, object>? additionalData = null) { }
        public void LogAuthenticationFailure(string? username, string reason, string? ipAddress = null) { }
        public void LogPermissionEscalation(ClaimsPrincipal user, string targetUserId, string fromRole, string toRole) { }
        public void LogSuspiciousActivity(ClaimsPrincipal? user, string activity, string details, string? ipAddress = null) { }
    }

    private sealed class FakeSender : ISender
    {
        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
            => Task.FromResult<TResponse>(default!);
        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
            => Task.CompletedTask;
        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
            => Task.FromResult<object?>(null);
        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }
}

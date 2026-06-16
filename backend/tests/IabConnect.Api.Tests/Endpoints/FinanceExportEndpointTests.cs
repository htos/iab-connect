using FluentAssertions;
using IabConnect.Api.Endpoints;
using IabConnect.Application.Finance.Exports.Pain001;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-044 (E6-S3) AC-2/AC-4: the budget-vs-actual CSV export route carries `RequireFinanceRead`
/// and the group-level `Module:finance` gate.
/// </summary>
public sealed class FinanceExportEndpointTests
{
    [Theory]
    [InlineData("RequireFinanceRead")]
    [InlineData("Module:finance")]
    public void BudgetVsActualExport_CarriesPolicy(string policy)
    {
        var endpoint = ResolveEndpoint("/api/v1/finance/exports/budget-vs-actual", "GET");
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Should().Contain(d => d.Policy == policy);
    }

    private static RouteEndpoint ResolveEndpoint(string routePattern, string httpMethod)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("RequireFinanceRead", p => p.RequireRole("admin", "kassier", "auditor"))
            .AddPolicy("RequireFinanceWrite", p => p.RequireRole("admin", "kassier"))
            .AddPolicy("Module:finance", p => p.RequireAuthenticatedUser());
        builder.Services.AddSingleton<ISender, FakeSender>();
        builder.Services.AddSingleton(Moq.Mock.Of<IPain001Generator>());

        var app = builder.Build();
        app.MapFinanceExportEndpoints();

        var endpoints = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(d => d.Endpoints)
            .OfType<RouteEndpoint>()
            .Where(r => r.RoutePattern.RawText == routePattern)
            .ToList();
        endpoints.Should().NotBeEmpty($"route {routePattern} should be registered");
        return endpoints.Single(r => r.Metadata.GetOrderedMetadata<HttpMethodMetadata>()
            .Any(m => m.HttpMethods.Contains(httpMethod)));
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

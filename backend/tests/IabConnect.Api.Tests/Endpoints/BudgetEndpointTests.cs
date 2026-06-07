using FluentAssertions;
using IabConnect.Api.Endpoints;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-044 (E6-S1) AC-4: API-layer endpoint-metadata coverage for the budget surface.
/// Confirms read routes carry <c>RequireFinanceRead</c>, write routes carry <c>RequireFinanceWrite</c>,
/// and the whole group carries the <c>Module:finance</c> gate + group authentication.
/// </summary>
public sealed class BudgetEndpointTests
{
    [Theory]
    [InlineData("/api/v1/finance/budgets/", "GET")]
    [InlineData("/api/v1/finance/budgets/{id:guid}", "GET")]
    [InlineData("/api/v1/finance/budgets/budget-vs-actual", "GET")]
    public void ReadEndpoints_RequireFinanceRead(string routePattern, string method)
    {
        var endpoint = ResolveEndpoint(routePattern, method);
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Should().Contain(d => d.Policy == "RequireFinanceRead");
    }

    [Theory]
    [InlineData("/api/v1/finance/budgets/", "POST")]
    [InlineData("/api/v1/finance/budgets/{id:guid}", "PUT")]
    [InlineData("/api/v1/finance/budgets/{id:guid}", "DELETE")]
    public void WriteEndpoints_RequireFinanceWrite(string routePattern, string method)
    {
        var endpoint = ResolveEndpoint(routePattern, method);
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Should().Contain(d => d.Policy == "RequireFinanceWrite");
    }

    [Theory]
    [InlineData("/api/v1/finance/budgets/", "GET")]
    [InlineData("/api/v1/finance/budgets/", "POST")]
    [InlineData("/api/v1/finance/budgets/{id:guid}", "DELETE")]
    [InlineData("/api/v1/finance/budgets/budget-vs-actual", "GET")]
    public void AllEndpoints_CarryModuleFinanceGate(string routePattern, string method)
    {
        var endpoint = ResolveEndpoint(routePattern, method);
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Should().Contain(d => d.Policy == "Module:finance");
    }

    private static RouteEndpoint ResolveEndpoint(string routePattern, string httpMethod)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("RequireFinanceRead", p => p.RequireRole("admin", "kassier", "auditor"))
            .AddPolicy("RequireFinanceWrite", p => p.RequireRole("admin", "kassier"))
            .AddPolicy("Module:finance", p => p.RequireAuthenticatedUser());
        builder.Services.AddSingleton<ISender, FakeSender>();

        var app = builder.Build();
        app.MapBudgetEndpoints();

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

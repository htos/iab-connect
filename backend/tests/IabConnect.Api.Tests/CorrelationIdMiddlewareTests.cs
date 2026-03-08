using FluentAssertions;
using IabConnect.Api.Middleware;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace IabConnect.Api.Tests;

public class CorrelationIdMiddlewareTests
{
    private const string CorrelationIdHeader = "X-Correlation-Id";

    [Fact]
    public async Task InvokeAsync_NoHeader_GeneratesCorrelationId()
    {
        // Arrange
        var context = new DefaultHttpContext();
        var middleware = new CorrelationIdMiddleware(_ => Task.CompletedTask);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.Headers[CorrelationIdHeader].ToString().Should().NotBeNullOrEmpty();
        context.Items["CorrelationId"].Should().NotBeNull();
    }

    [Fact]
    public async Task InvokeAsync_WithExistingHeader_UsesProvidedId()
    {
        // Arrange
        var expectedId = "test-correlation-123";
        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationIdHeader] = expectedId;
        var middleware = new CorrelationIdMiddleware(_ => Task.CompletedTask);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.Headers[CorrelationIdHeader].ToString().Should().Be(expectedId);
        context.Items["CorrelationId"].Should().Be(expectedId);
    }

    [Fact]
    public async Task InvokeAsync_SetsResponseHeader()
    {
        // Arrange
        var context = new DefaultHttpContext();
        var middleware = new CorrelationIdMiddleware(_ => Task.CompletedTask);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        var responseId = context.Response.Headers[CorrelationIdHeader].ToString();
        responseId.Should().NotBeNullOrEmpty();
        Guid.TryParse(responseId, out _).Should().BeTrue("generated ID should be a valid GUID");
    }

    [Fact]
    public async Task InvokeAsync_CallsNextMiddleware()
    {
        // Arrange
        var context = new DefaultHttpContext();
        var nextCalled = false;
        var middleware = new CorrelationIdMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextCalled.Should().BeTrue();
    }

    [Fact]
    public async Task InvokeAsync_CorrelationIdInItems_MatchesResponseHeader()
    {
        // Arrange
        var context = new DefaultHttpContext();
        var middleware = new CorrelationIdMiddleware(_ => Task.CompletedTask);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        var itemsId = context.Items["CorrelationId"] as string;
        var headerId = context.Response.Headers[CorrelationIdHeader].ToString();
        itemsId.Should().Be(headerId);
    }
}

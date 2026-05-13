using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// xUnit collection definition for all API integration tests that need a live HTTP pipeline
/// (i.e. a <see cref="TestWebApplicationFactory"/>). Membership in this collection makes the
/// tests share a single factory instance per test run, sidestepping Serilog's frozen-logger
/// collision when a second <c>WebApplicationFactory&lt;Program&gt;</c> would otherwise be
/// instantiated.
///
/// Usage: decorate the test class with <c>[Collection("Api")]</c> and accept
/// <see cref="TestWebApplicationFactory"/> via the constructor.
/// </summary>
[CollectionDefinition("Api")]
public sealed class ApiTestCollection : ICollectionFixture<TestWebApplicationFactory>
{
    // Intentionally empty — xUnit uses the type only as a marker for collection definition.
}

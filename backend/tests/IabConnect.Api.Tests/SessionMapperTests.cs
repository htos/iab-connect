using FluentAssertions;
using IabConnect.Api.Endpoints;
using IabConnect.Infrastructure.Identity;
using Xunit;

namespace IabConnect.Api.Tests;

public sealed class SessionMapperTests
{
    [Fact]
    public void ToDto_FiltersOutInternalKeycloakClientNames_ByDefault()
    {
        var session = new KeycloakSessionRepresentation
        {
            Id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            IpAddress = "10.0.0.1",
            Clients = new Dictionary<string, string>
            {
                ["client-uuid-1"] = "iabconnect-frontend",
                ["client-uuid-2"] = "admin-cli",
                ["client-uuid-3"] = "security-admin-console",
                ["client-uuid-4"] = "account",
                ["client-uuid-5"] = "account-console",
                ["client-uuid-6"] = "realm-management",
                ["client-uuid-7"] = "broker",
                ["client-uuid-8"] = "iabconnect-admin",
                ["client-uuid-9"] = "some-app",
            }
        };

        var dto = SessionMapper.ToDto(session);

        dto.Clients.Should().BeEquivalentTo(["iabconnect-frontend", "some-app"]);
    }

    [Fact]
    public void ToDto_FilterIsCaseInsensitive()
    {
        var session = new KeycloakSessionRepresentation
        {
            Id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            Clients = new Dictionary<string, string>
            {
                ["uuid-1"] = "Admin-CLI",
                ["uuid-2"] = "SECURITY-ADMIN-CONSOLE",
                ["uuid-3"] = "iabconnect-frontend",
            }
        };

        var dto = SessionMapper.ToDto(session);

        dto.Clients.Should().BeEquivalentTo(["iabconnect-frontend"]);
    }

    [Fact]
    public void ToDto_KeepsExternalClientsWhenNoInternalsPresent()
    {
        var session = new KeycloakSessionRepresentation
        {
            Id = "cccccccc-cccc-cccc-cccc-cccccccccccc",
            Clients = new Dictionary<string, string>
            {
                ["uuid-1"] = "iabconnect-frontend",
                ["uuid-2"] = "mobile-app",
            }
        };

        var dto = SessionMapper.ToDto(session);

        dto.Clients.Should().BeEquivalentTo(["iabconnect-frontend", "mobile-app"]);
    }

    [Fact]
    public void ToDto_NullOrEmptyClientNamesAreStillExcluded()
    {
        var session = new KeycloakSessionRepresentation
        {
            Id = "dddddddd-dddd-dddd-dddd-dddddddddddd",
            Clients = new Dictionary<string, string>
            {
                ["uuid-1"] = "",
                ["uuid-2"] = "   ",
                ["uuid-3"] = "iabconnect-frontend",
            }
        };

        var dto = SessionMapper.ToDto(session);

        dto.Clients.Should().BeEquivalentTo(["iabconnect-frontend"]);
    }

    [Fact]
    public void ToDto_AcceptsExplicitInternalClientsOverride()
    {
        // Allow callers to provide a stricter or different filter set for tests / future configurability.
        var session = new KeycloakSessionRepresentation
        {
            Id = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
            Clients = new Dictionary<string, string>
            {
                ["uuid-1"] = "admin-cli",
                ["uuid-2"] = "custom-internal",
                ["uuid-3"] = "iabconnect-frontend",
            }
        };

        var custom = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "custom-internal" };

        var dto = SessionMapper.ToDto(session, custom);

        // Only "custom-internal" filtered; default internals like "admin-cli" pass through under the override.
        dto.Clients.Should().BeEquivalentTo(["admin-cli", "iabconnect-frontend"]);
    }

    [Fact]
    public void ToDto_NullClientsDictionary_ReturnsEmptyList()
    {
        var session = new KeycloakSessionRepresentation
        {
            Id = "ffffffff-ffff-ffff-ffff-ffffffffffff",
            Clients = null,
        };

        var dto = SessionMapper.ToDto(session);

        dto.Clients.Should().BeEmpty();
    }
}

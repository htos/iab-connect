using FluentAssertions;
using IabConnect.Application.Integration.Commands;
using IabConnect.Domain.Integration;
using Xunit;

namespace IabConnect.Application.Tests.Integration;

/// <summary>
/// REQ-058 (E8-S1): domain + validator tests for <see cref="ApiClient"/> and
/// <see cref="CreateApiClientCommandValidator"/> — the closed scope set is enforced at the write
/// boundary, the raw secret never lives on the entity, and lifecycle invariants hold.
/// </summary>
public sealed class ApiClientTests
{
    [Fact]
    public void Create_WithValidScopes_Succeeds()
    {
        var client = ApiClient.Create("Partner X", [ApiScopes.EventsRead, ApiScopes.BlogRead], "prefix1", "hash1");

        client.Name.Should().Be("Partner X");
        client.Scopes.Should().BeEquivalentTo([ApiScopes.EventsRead, ApiScopes.BlogRead]);
        client.IsRevoked.Should().BeFalse();
        client.SecretHash.Should().Be("hash1");
        client.LastUsedAt.Should().BeNull();
    }

    [Fact]
    public void Create_WithUnknownScope_Throws()
    {
        var act = () => ApiClient.Create("Bad", ["members:read"], "p", "h");
        act.Should().Throw<ArgumentException>().WithMessage("*Unknown API scope*");
    }

    [Fact]
    public void Create_WithBlankName_Throws()
    {
        var act = () => ApiClient.Create("  ", [ApiScopes.EventsRead], "p", "h");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_DeduplicatesScopes()
    {
        var client = ApiClient.Create("Dup", [ApiScopes.EventsRead, ApiScopes.EventsRead], "p", "h");
        client.Scopes.Should().ContainSingle().Which.Should().Be(ApiScopes.EventsRead);
    }

    [Fact]
    public void Revoke_SetsFlagAndTimestamp()
    {
        var client = ApiClient.Create("X", [ApiScopes.EventsRead], "p", "h");
        client.Revoke();
        client.IsRevoked.Should().BeTrue();
        client.RevokedAt.Should().NotBeNull();
    }

    [Fact]
    public void Revoke_Twice_Throws()
    {
        var client = ApiClient.Create("X", [ApiScopes.EventsRead], "p", "h");
        client.Revoke();
        var act = () => client.Revoke();
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void RecordUse_SetsLastUsedAt()
    {
        var client = ApiClient.Create("X", [ApiScopes.EventsRead], "p", "h");
        var when = new DateTime(2026, 6, 7, 12, 0, 0, DateTimeKind.Utc);
        client.RecordUse(when);
        client.LastUsedAt.Should().Be(when);
    }

    [Fact]
    public void ApiScopes_AreAllKnown_DetectsUnknown()
    {
        ApiScopes.AreAllKnown([ApiScopes.EventsRead]).Should().BeTrue();
        ApiScopes.AreAllKnown([ApiScopes.EventsRead, "nope"]).Should().BeFalse();
    }

    [Fact]
    public void Validator_RejectsUnknownScope()
    {
        var result = new CreateApiClientCommandValidator().Validate(
            new CreateApiClientCommand { Name = "X", Scopes = ["nope:read"] });
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validator_RejectsEmptyScopes()
    {
        var result = new CreateApiClientCommandValidator().Validate(
            new CreateApiClientCommand { Name = "X", Scopes = [] });
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validator_AcceptsKnownScopes()
    {
        var result = new CreateApiClientCommandValidator().Validate(
            new CreateApiClientCommand { Name = "X", Scopes = [ApiScopes.EventsRead] });
        result.IsValid.Should().BeTrue();
    }
}

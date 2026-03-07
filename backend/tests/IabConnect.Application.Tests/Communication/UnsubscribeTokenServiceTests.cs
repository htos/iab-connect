using FluentAssertions;
using IabConnect.Infrastructure.Email;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace IabConnect.Application.Tests.Communication;

/// <summary>
/// REQ-029: Unit Tests for UnsubscribeTokenService (HMAC-based tokens)
/// </summary>
public class UnsubscribeTokenServiceTests
{
    private readonly UnsubscribeTokenService _service;

    public UnsubscribeTokenServiceTests()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Email:UnsubscribeSecret"] = "test-secret-key-for-unit-tests"
            })
            .Build();
        _service = new UnsubscribeTokenService(config);
    }

    [Fact]
    public void GenerateToken_ShouldReturnNonEmptyString()
    {
        var recipientId = Guid.NewGuid();

        var token = _service.GenerateToken(recipientId);

        token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void ValidateToken_WithValidToken_ShouldReturnRecipientId()
    {
        var recipientId = Guid.NewGuid();
        var token = _service.GenerateToken(recipientId);

        var result = _service.ValidateToken(token);

        result.Should().Be(recipientId);
    }

    [Fact]
    public void ValidateToken_WithTamperedToken_ShouldReturnNull()
    {
        var recipientId = Guid.NewGuid();
        var token = _service.GenerateToken(recipientId);

        // Tamper with the token
        var chars = token.ToCharArray();
        chars[0] = chars[0] == 'A' ? 'B' : 'A';
        var tamperedToken = new string(chars);

        var result = _service.ValidateToken(tamperedToken);

        result.Should().BeNull();
    }

    [Fact]
    public void ValidateToken_WithInvalidBase64_ShouldReturnNull()
    {
        var result = _service.ValidateToken("not-a-valid-token!!!");

        result.Should().BeNull();
    }

    [Fact]
    public void ValidateToken_WithTooShortPayload_ShouldReturnNull()
    {
        // Valid base64 but too short to be a valid token
        var result = _service.ValidateToken(Convert.ToBase64String(new byte[8]));

        result.Should().BeNull();
    }

    [Fact]
    public void GenerateToken_SameRecipient_ShouldGenerateSameToken()
    {
        var recipientId = Guid.NewGuid();

        var token1 = _service.GenerateToken(recipientId);
        var token2 = _service.GenerateToken(recipientId);

        token1.Should().Be(token2);
    }

    [Fact]
    public void GenerateToken_DifferentRecipients_ShouldGenerateDifferentTokens()
    {
        var token1 = _service.GenerateToken(Guid.NewGuid());
        var token2 = _service.GenerateToken(Guid.NewGuid());

        token1.Should().NotBe(token2);
    }

    [Fact]
    public void ValidateToken_FromDifferentServiceInstance_WithSameKey_ShouldWork()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Email:UnsubscribeSecret"] = "test-secret-key-for-unit-tests"
            })
            .Build();
        var otherService = new UnsubscribeTokenService(config);

        var recipientId = Guid.NewGuid();
        var token = _service.GenerateToken(recipientId);

        var result = otherService.ValidateToken(token);

        result.Should().Be(recipientId);
    }

    [Fact]
    public void ValidateToken_FromServiceWithDifferentKey_ShouldReturnNull()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Email:UnsubscribeSecret"] = "completely-different-key"
            })
            .Build();
        var otherService = new UnsubscribeTokenService(config);

        var recipientId = Guid.NewGuid();
        var token = _service.GenerateToken(recipientId);

        var result = otherService.ValidateToken(token);

        result.Should().BeNull();
    }
}

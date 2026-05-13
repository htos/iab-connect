using FluentAssertions;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using Moq;
using Xunit;
using FindMemberDuplicatesQuery = IabConnect.Application.Members.Queries.FindMemberDuplicatesQuery;
using FindMemberDuplicatesQueryHandler = IabConnect.Application.Members.Queries.FindMemberDuplicatesQueryHandler;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// REQ-018: Unit tests for the duplicates query handler.
/// Focus areas: ordering (Exact before Likely), 20-result cap, ExcludeMemberId pass-through,
/// privacy-respecting DTO surface (AC-6).
/// </summary>
public sealed class FindMemberDuplicatesQueryHandlerTests
{
    private readonly Mock<IMemberRepository> _repo = new();
    private readonly DuplicateMatcher _matcher = new();
    private readonly FindMemberDuplicatesQueryHandler _handler;

    public FindMemberDuplicatesQueryHandlerTests()
    {
        _handler = new FindMemberDuplicatesQueryHandler(_repo.Object, _matcher);
    }

    [Fact]
    public async Task Handle_NoSignals_ReturnsEmpty()
    {
        var query = new FindMemberDuplicatesQuery(null, null, null, null, null, null);

        var result = await _handler.Handle(query, TestContext.Current.CancellationToken);

        result.Should().BeEmpty();
        _repo.Verify(r => r.FindCandidatesAsync(
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<Guid?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_OrdersExactBeforeLikely()
    {
        // Exact tier fires on normalized-email equality.
        // Likely tier fires on name match + email-local-part match (no street parameter on the API,
        // so PostalAndStreet is not exercised here).
        var exactMatch = MakeMember("Max", "Mueller", "max@example.com");
        var likelyMatch = MakeMember("Max", "Mueller", "max@othermail.com");

        _repo.Setup(r => r.FindCandidatesAsync(
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<Guid?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { likelyMatch, exactMatch });

        var query = new FindMemberDuplicatesQuery(
            Email: "max@example.com",
            Phone: null,
            FirstName: "Max",
            LastName: "Mueller",
            PostalCode: null,
            ExcludeMemberId: null);

        var result = await _handler.Handle(query, TestContext.Current.CancellationToken);

        result.Should().HaveCount(2);
        result[0].MatchTier.Should().Be(MatchTier.Exact);
        result[1].MatchTier.Should().Be(MatchTier.Likely);
    }

    [Fact]
    public async Task Handle_CapsAtTwentyResults()
    {
        // Generate 30 members that all match by exact email
        var members = Enumerable.Range(0, 30)
            .Select(i => MakeMember($"Name{i}", $"Surname{i}", "shared@example.com", "1000", "Foo"))
            .ToArray();

        _repo.Setup(r => r.FindCandidatesAsync(
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<Guid?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(members);

        var query = new FindMemberDuplicatesQuery(
            Email: "shared@example.com",
            Phone: null, FirstName: null, LastName: null, PostalCode: null, ExcludeMemberId: null);

        var result = await _handler.Handle(query, TestContext.Current.CancellationToken);

        result.Should().HaveCount(20);
    }

    [Fact]
    public async Task Handle_PassesExcludeMemberIdToRepository()
    {
        var excludeId = Guid.NewGuid();
        _repo.Setup(r => r.FindCandidatesAsync(
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<Guid?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<Member>());

        var query = new FindMemberDuplicatesQuery(
            Email: "a@x.com",
            Phone: null, FirstName: null, LastName: null, PostalCode: null,
            ExcludeMemberId: excludeId);

        await _handler.Handle(query, TestContext.Current.CancellationToken);

        _repo.Verify(r => r.FindCandidatesAsync(
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), excludeId, It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_DtoOmitsPhoneAddressAndKeycloakId()
    {
        var member = MakeMember(
            firstName: "Max",
            lastName: "Mueller",
            email: "max@example.com",
            postalCode: "3011",
            street: "Bundesplatz 1",
            phone: "+41 79 999 88 77");
        member.LinkToKeycloak(Guid.NewGuid());

        _repo.Setup(r => r.FindCandidatesAsync(
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<Guid?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { member });

        var query = new FindMemberDuplicatesQuery(
            Email: "max@example.com",
            Phone: null, FirstName: null, LastName: null, PostalCode: null, ExcludeMemberId: null);

        var result = await _handler.Handle(query, TestContext.Current.CancellationToken);

        result.Should().HaveCount(1);
        var dto = result[0];

        // Verify only AC-6 properties exist (compile-time check via record shape)
        dto.Should().BeOfType<DuplicateCandidateDto>();

        // Runtime check: reflect over the DTO type to ensure no forbidden properties leak
        var properties = typeof(DuplicateCandidateDto)
            .GetProperties()
            .Select(p => p.Name)
            .ToArray();

        properties.Should().NotContain("Phone");
        properties.Should().NotContain("Address");
        properties.Should().NotContain("KeycloakUserId");
        properties.Should().NotContain("Street");
        properties.Should().NotContain("PostalCode");
    }

    private static Member MakeMember(
        string firstName,
        string lastName,
        string email,
        string postalCode = "0000",
        string street = "Nicht angegeben",
        string? phone = null)
    {
        var address = Address.Create(street, "City", postalCode, "Schweiz");
        return Member.Create(firstName, lastName, email, address, MembershipType.Regular, phone);
    }
}

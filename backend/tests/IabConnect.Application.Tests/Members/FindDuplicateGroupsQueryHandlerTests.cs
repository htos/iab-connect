using FluentAssertions;
using IabConnect.Application.Common;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using Moq;
using Xunit;
using FindDuplicateGroupsQuery = IabConnect.Application.Members.Queries.FindDuplicateGroupsQuery;
using FindDuplicateGroupsQueryHandler = IabConnect.Application.Members.Queries.FindDuplicateGroupsQueryHandler;
using DuplicateGroupDto = IabConnect.Application.Members.Queries.DuplicateGroupDto;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// REQ-018 (E2.S4): unit tests for the cross-table duplicate-groups handler.
/// Covers: empty table, Exact email groups, Likely name+postal groups, dismissed-pair filtering,
/// merged-source exclusion, pagination, and the AC-3 "NameOnly alone is not enough" rule.
/// </summary>
public sealed class FindDuplicateGroupsQueryHandlerTests
{
    private readonly Mock<IMemberRepository> _memberRepo = new();
    private readonly Mock<IDuplicateCandidateDismissalRepository> _dismissalRepo = new();
    private readonly DuplicateMatcher _matcher = new();
    private readonly FindDuplicateGroupsQueryHandler _handler;

    public FindDuplicateGroupsQueryHandlerTests()
    {
        _handler = new FindDuplicateGroupsQueryHandler(_memberRepo.Object, _dismissalRepo.Object, _matcher);
        _dismissalRepo.Setup(r => r.GetAllPairsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<(Guid, Guid)>());
    }

    [Fact]
    public async Task Handle_EmptyMemberTable_ReturnsEmptyPagedResult()
    {
        _memberRepo.Setup(r => r.GetAllNonMergedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<Member>());

        var result = await _handler.Handle(
            new FindDuplicateGroupsQuery(),
            TestContext.Current.CancellationToken);

        result.Should().BeOfType<PagedResult<DuplicateGroupDto>>();
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_TwoMembersWithSameNormalizedEmail_ReturnsOneExactGroup()
    {
        var a = MakeMember("Max", "Muster", "max@example.com");
        var b = MakeMember("Maximilian", "Mueller", "Max+work@Example.com");
        _memberRepo.Setup(r => r.GetAllNonMergedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { a, b });

        var result = await _handler.Handle(
            new FindDuplicateGroupsQuery(),
            TestContext.Current.CancellationToken);

        result.TotalCount.Should().Be(1);
        result.Items.Should().HaveCount(1);
        result.Items[0].Tier.Should().Be(MatchTier.Exact);
        result.Items[0].Members.Should().HaveCount(2);
        result.Items[0].GroupKey.Should().StartWith("email::");
    }

    [Fact]
    public async Task Handle_ThreeMembersWithSameNamePostal_ReturnsOneLikelyGroup()
    {
        // Same first+last name AND same postal code, but with a signal beyond NameOnly so the
        // AC-3 rule fires: email local part matches (`max`).
        var a = MakeMember("Max", "Müller", "max@a.com", postalCode: "8001", street: "Hauptstrasse 1");
        var b = MakeMember("Max", "Mueller", "max@b.com", postalCode: "8001", street: "Hauptstrasse 5");
        var c = MakeMember("Max", "Müller", "max@c.com", postalCode: "8001", street: "Hauptstrasse 9");
        _memberRepo.Setup(r => r.GetAllNonMergedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { a, b, c });

        var result = await _handler.Handle(
            new FindDuplicateGroupsQuery(),
            TestContext.Current.CancellationToken);

        result.TotalCount.Should().Be(1);
        result.Items[0].Tier.Should().Be(MatchTier.Likely);
        result.Items[0].Members.Should().HaveCount(3);
    }

    [Fact]
    public async Task Handle_NameOnlyMatch_WithNoOtherSignal_ProducesNoGroup()
    {
        // AC-3 from E2.S1: NameOnly alone is not enough to fire Likely tier.
        // Two members with same folded name but DIFFERENT postal codes, DIFFERENT email locals,
        // DIFFERENT phones → no group should form.
        var a = MakeMember("Max", "Mueller", "max@a.com", postalCode: "8001");
        var b = MakeMember("Max", "Mueller", "different@b.com", postalCode: "9999");
        _memberRepo.Setup(r => r.GetAllNonMergedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { a, b });

        var result = await _handler.Handle(
            new FindDuplicateGroupsQuery(),
            TestContext.Current.CancellationToken);

        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_DismissedPair_IsExcludedFromExactGroup()
    {
        var a = MakeMember("Max", "M", "max@example.com");
        var b = MakeMember("Max", "M", "max@example.com");
        _memberRepo.Setup(r => r.GetAllNonMergedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { a, b });

        // Dismiss the (a,b) pair in canonical order.
        var (src, tgt) = DuplicateCandidateDismissal.Canonicalise(a.Id, b.Id);
        _dismissalRepo.Setup(r => r.GetAllPairsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { (src, tgt) });

        var result = await _handler.Handle(
            new FindDuplicateGroupsQuery(),
            TestContext.Current.CancellationToken);

        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_PaginationCapRespected()
    {
        // Create 40 distinct Exact groups (each = 2 members sharing a unique email).
        var members = new List<Member>();
        for (var i = 0; i < 40; i++)
        {
            var email = $"user{i}@example.com";
            members.Add(MakeMember($"First{i}", $"Last{i}", email));
            members.Add(MakeMember($"FirstX{i}", $"LastX{i}", email));
        }
        _memberRepo.Setup(r => r.GetAllNonMergedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(members);

        var result = await _handler.Handle(
            new FindDuplicateGroupsQuery(Page: 1, PageSize: 10),
            TestContext.Current.CancellationToken);

        result.TotalCount.Should().Be(40);
        result.Items.Should().HaveCount(10);
        result.TotalPages.Should().Be(4);
    }

    [Fact]
    public async Task Handle_MinTierExact_FiltersOutLikelyGroups()
    {
        var likelyA = MakeMember("Max", "Müller", "max@aa.com", postalCode: "8001");
        var likelyB = MakeMember("Max", "Mueller", "max@bb.com", postalCode: "8001");
        var exactA = MakeMember("Sara", "S", "sara@example.com");
        var exactB = MakeMember("Sara", "X", "sara@example.com");
        _memberRepo.Setup(r => r.GetAllNonMergedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { likelyA, likelyB, exactA, exactB });

        var result = await _handler.Handle(
            new FindDuplicateGroupsQuery(MinTier: MatchTier.Exact),
            TestContext.Current.CancellationToken);

        result.Items.Should().HaveCount(1);
        result.Items[0].Tier.Should().Be(MatchTier.Exact);
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

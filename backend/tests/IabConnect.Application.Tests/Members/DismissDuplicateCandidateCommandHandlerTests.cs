using FluentAssertions;
using IabConnect.Application.Members.Commands;
using IabConnect.Domain.Members;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// REQ-018 (E2.S4): unit tests for DismissDuplicateCandidateCommandHandler.
/// Covers canonical-pair ordering, 404 on missing member, 404 on merged source,
/// idempotent re-dismissal, and the AddAtomicAsync contract.
/// </summary>
public sealed class DismissDuplicateCandidateCommandHandlerTests
{
    private readonly Mock<IMemberRepository> _memberRepo = new();
    private readonly Mock<IDuplicateCandidateDismissalRepository> _dismissalRepo = new();
    private readonly DismissDuplicateCandidateCommandHandler _handler;

    public DismissDuplicateCandidateCommandHandlerTests()
    {
        _handler = new DismissDuplicateCandidateCommandHandler(
            _memberRepo.Object, _dismissalRepo.Object);
    }

    [Fact]
    public async Task Handle_CanonicalisesPairBeforeInsert()
    {
        // Provide the pair "backwards" (larger GUID as MemberA). Handler must store in canonical order.
        var memberA = MakeMember();
        var memberB = MakeMember();
        if (memberA.Id.CompareTo(memberB.Id) < 0)
        {
            (memberA, memberB) = (memberB, memberA);
        }

        _memberRepo.Setup(r => r.GetByIdAsync(memberA.Id, It.IsAny<CancellationToken>())).ReturnsAsync(memberA);
        _memberRepo.Setup(r => r.GetByIdAsync(memberB.Id, It.IsAny<CancellationToken>())).ReturnsAsync(memberB);
        _dismissalRepo.Setup(r => r.GetByCanonicalPairAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DuplicateCandidateDismissal?)null);

        DuplicateCandidateDismissal? captured = null;
        _dismissalRepo.Setup(r => r.AddAtomicAsync(It.IsAny<DuplicateCandidateDismissal>(), It.IsAny<CancellationToken>()))
            .Callback<DuplicateCandidateDismissal, CancellationToken>((d, _) => captured = d)
            .ReturnsAsync((DuplicateCandidateDismissal d, CancellationToken _) => (d, true));

        var command = new DismissDuplicateCandidateCommand(
            MemberA: memberA.Id,
            MemberB: memberB.Id,
            Reason: "Different people.",
            DismissedByUserId: Guid.NewGuid());

        var result = await _handler.Handle(command, TestContext.Current.CancellationToken);

        result.Created.Should().BeTrue();
        captured.Should().NotBeNull();
        captured!.SourceMemberId.CompareTo(captured.TargetMemberId).Should().BeLessThan(0,
            "the persisted pair must be in canonical (smaller, larger) order");
    }

    [Fact]
    public async Task Handle_MissingMember_ThrowsKeyNotFoundException()
    {
        var realMember = MakeMember();
        var ghostId = Guid.NewGuid();

        _memberRepo.Setup(r => r.GetByIdAsync(realMember.Id, It.IsAny<CancellationToken>())).ReturnsAsync(realMember);
        _memberRepo.Setup(r => r.GetByIdAsync(ghostId, It.IsAny<CancellationToken>())).ReturnsAsync((Member?)null);

        var command = new DismissDuplicateCandidateCommand(
            MemberA: realMember.Id,
            MemberB: ghostId,
            Reason: "x",
            DismissedByUserId: Guid.NewGuid());

        await FluentActions.Awaiting(() =>
                _handler.Handle(command, TestContext.Current.CancellationToken))
            .Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Handle_MergedSourceMember_ThrowsKeyNotFoundException()
    {
        var alive = MakeMember();
        var merged = MakeMember();
        merged.MarkMergedInto(Guid.NewGuid(), Guid.NewGuid());

        _memberRepo.Setup(r => r.GetByIdAsync(alive.Id, It.IsAny<CancellationToken>())).ReturnsAsync(alive);
        _memberRepo.Setup(r => r.GetByIdAsync(merged.Id, It.IsAny<CancellationToken>())).ReturnsAsync(merged);

        var command = new DismissDuplicateCandidateCommand(
            MemberA: alive.Id,
            MemberB: merged.Id,
            Reason: "x",
            DismissedByUserId: Guid.NewGuid());

        await FluentActions.Awaiting(() =>
                _handler.Handle(command, TestContext.Current.CancellationToken))
            .Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Handle_IdempotentDismissal_ReturnsExistingRowAndSkipsInsert()
    {
        var a = MakeMember();
        var b = MakeMember();
        _memberRepo.Setup(r => r.GetByIdAsync(a.Id, It.IsAny<CancellationToken>())).ReturnsAsync(a);
        _memberRepo.Setup(r => r.GetByIdAsync(b.Id, It.IsAny<CancellationToken>())).ReturnsAsync(b);

        var existing = DuplicateCandidateDismissal.Create(a.Id, b.Id, Guid.NewGuid(), "earlier reason");
        _dismissalRepo.Setup(r => r.GetByCanonicalPairAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var command = new DismissDuplicateCandidateCommand(
            MemberA: a.Id,
            MemberB: b.Id,
            Reason: "now",
            DismissedByUserId: Guid.NewGuid());

        var result = await _handler.Handle(command, TestContext.Current.CancellationToken);

        result.Created.Should().BeFalse();
        result.DismissalId.Should().Be(existing.Id);
        _dismissalRepo.Verify(r => r.AddAtomicAsync(It.IsAny<DuplicateCandidateDismissal>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_NewDismissal_CallsAddAtomicOnce()
    {
        var a = MakeMember();
        var b = MakeMember();
        _memberRepo.Setup(r => r.GetByIdAsync(a.Id, It.IsAny<CancellationToken>())).ReturnsAsync(a);
        _memberRepo.Setup(r => r.GetByIdAsync(b.Id, It.IsAny<CancellationToken>())).ReturnsAsync(b);
        _dismissalRepo.Setup(r => r.GetByCanonicalPairAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DuplicateCandidateDismissal?)null);
        _dismissalRepo.Setup(r => r.AddAtomicAsync(It.IsAny<DuplicateCandidateDismissal>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DuplicateCandidateDismissal d, CancellationToken _) => (d, true));

        var command = new DismissDuplicateCandidateCommand(
            MemberA: a.Id,
            MemberB: b.Id,
            Reason: "test",
            DismissedByUserId: Guid.NewGuid());

        await _handler.Handle(command, TestContext.Current.CancellationToken);

        _dismissalRepo.Verify(r => r.AddAtomicAsync(It.IsAny<DuplicateCandidateDismissal>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_ConcurrentRace_AddAtomicReturnsExistingAsCreatedFalse()
    {
        // REQ-018 review patch: when two admins race the same canonical pair, the repository
        // catches DbUpdateException internally and returns the winning row as (existing, false).
        var a = MakeMember();
        var b = MakeMember();
        _memberRepo.Setup(r => r.GetByIdAsync(a.Id, It.IsAny<CancellationToken>())).ReturnsAsync(a);
        _memberRepo.Setup(r => r.GetByIdAsync(b.Id, It.IsAny<CancellationToken>())).ReturnsAsync(b);
        _dismissalRepo.Setup(r => r.GetByCanonicalPairAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DuplicateCandidateDismissal?)null);

        var winner = DuplicateCandidateDismissal.Create(a.Id, b.Id, Guid.NewGuid(), "winner reason");
        _dismissalRepo.Setup(r => r.AddAtomicAsync(It.IsAny<DuplicateCandidateDismissal>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((winner, false));

        var command = new DismissDuplicateCandidateCommand(
            MemberA: a.Id,
            MemberB: b.Id,
            Reason: "loser reason",
            DismissedByUserId: Guid.NewGuid());

        var result = await _handler.Handle(command, TestContext.Current.CancellationToken);

        result.Created.Should().BeFalse();
        result.DismissalId.Should().Be(winner.Id);
    }

    private static Member MakeMember()
    {
        var address = Address.Create("Strasse 1", "Stadt", "0000", "Schweiz");
        return Member.Create("First", "Last", $"u-{Guid.NewGuid():N}@example.com",
            address, IabConnect.Domain.Members.MembershipType.Regular);
    }
}

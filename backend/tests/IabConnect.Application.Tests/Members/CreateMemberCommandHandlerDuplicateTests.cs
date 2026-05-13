using FluentAssertions;
using IabConnect.Application.Common;
using IabConnect.Application.Members;
using IabConnect.Application.Members.Commands;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using Moq;
using Xunit;
using CommandMembershipType = IabConnect.Application.Members.Commands.MembershipType;
using DomainMembershipType = IabConnect.Domain.Members.MembershipType;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// REQ-018 (E2.S2): theory-driven duplicate-guard tests for <see cref="CreateMemberCommandHandler"/>.
/// Verifies that the new <c>GetByEmailNormalizedAsync</c>-based guard fires for case-different
/// and <c>+tag</c>-aliased emails and that a typed <see cref="DuplicateMemberException"/>
/// (carrying <c>ExistingMemberId</c>) replaces the legacy <see cref="InvalidOperationException"/>.
/// </summary>
public sealed class CreateMemberCommandHandlerDuplicateTests
{
    private readonly Mock<IMemberRepository> _repo = new();
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly DuplicateMatcher _matcher = new();
    private readonly CreateMemberCommandHandler _handler;

    public CreateMemberCommandHandlerDuplicateTests()
    {
        _handler = new CreateMemberCommandHandler(_repo.Object, _uow.Object, _matcher);
    }

    [Theory]
    [InlineData("max@example.com", "max@example.com")]
    [InlineData("Max@Example.COM", "max@example.com")]
    [InlineData("max+work@example.com", "max@example.com")]
    [InlineData("MAX+TAG@EXAMPLE.COM", "max@example.com")]
    public async Task Handle_DuplicateEmailVariant_ThrowsDuplicateMemberException_WithExistingId(
        string requestEmail, string storedNormalizedEmail)
    {
        var existing = MakeMember("Max", "Muster", storedNormalizedEmail);
        _repo.Setup(r => r.GetByEmailNormalizedAsync(requestEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var command = NewCommand(requestEmail);

        var act = async () => await _handler.Handle(command, TestContext.Current.CancellationToken);

        var exception = await act.Should().ThrowExactlyAsync<DuplicateMemberException>();
        exception.Which.ExistingMemberId.Should().Be(existing.Id);
        exception.Which.NormalizedEmail.Should().Be("max@example.com");
        _repo.Verify(r => r.AddAsync(It.IsAny<Member>(), It.IsAny<CancellationToken>()), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_NoExistingMember_CreatesAndPersists()
    {
        _repo.Setup(r => r.GetByEmailNormalizedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        var command = NewCommand("newuser@example.com");

        var result = await _handler.Handle(command, TestContext.Current.CancellationToken);

        result.Should().NotBe(Guid.Empty);
        _repo.Verify(r => r.AddAsync(It.IsAny<Member>(), It.IsAny<CancellationToken>()), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_DuplicateGuard_DoesNotCallLegacyEmailExistsAsync()
    {
        // Regression: the symmetric-guard fix replaces EmailExistsAsync with the normalized lookup.
        // If a future refactor re-introduces the legacy call, this test fails fast.
        _repo.Setup(r => r.GetByEmailNormalizedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        await _handler.Handle(NewCommand("safe@example.com"), TestContext.Current.CancellationToken);

        _repo.Verify(
            r => r.EmailExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private static CreateMemberCommand NewCommand(string email) => new()
    {
        FirstName = "Max",
        LastName = "Muster",
        Email = email,
        Phone = null,
        Street = "Bundesplatz 1",
        City = "Bern",
        PostalCode = "3011",
        Country = "Schweiz",
        MembershipType = CommandMembershipType.Regular,
    };

    private static Member MakeMember(string firstName, string lastName, string email)
    {
        var address = Address.Create("Bundesplatz 1", "Bern", "3011", "Schweiz");
        return Member.Create(firstName, lastName, email, address, DomainMembershipType.Regular, null);
    }
}

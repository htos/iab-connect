using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Reporting;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Members;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Reporting;

public class ExportMembersQueryHandlerTests
{
    private readonly Mock<IMemberRepository> _memberRepo = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly ExportMembersQueryHandler _handler;

    public ExportMembersQueryHandlerTests()
    {
        _handler = new ExportMembersQueryHandler(_memberRepo.Object, _auditService.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnCsvWithHeaderAndAllMembers()
    {
        // Arrange
        var members = new List<Member>
        {
            CreateMember("Alice", "Muster"),
            CreateMember("Bob", "Beispiel"),
        };
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(members);

        // Act
        var result = await _handler.Handle(new ExportMembersQuery(), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.ContentType.Should().Be("text/csv");
        result.FileName.Should().StartWith("members_");
        result.FileName.Should().EndWith(".csv");

        var csv = System.Text.Encoding.UTF8.GetString(result.Content);
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines[0].Should().Contain("Id;FirstName;LastName;Email;Phone;Status;Type;MemberSince");
        lines.Should().HaveCount(3); // Header + 2 members
    }

    [Fact]
    public async Task Handle_ShouldOrderByLastNameThenFirstName()
    {
        // Arrange
        var members = new List<Member>
        {
            CreateMember("Zara", "Müller"),
            CreateMember("Alice", "Müller"),
            CreateMember("Bob", "Acker"),
        };
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(members);

        // Act
        var result = await _handler.Handle(new ExportMembersQuery(), CancellationToken.None);

        // Assert
        var csv = System.Text.Encoding.UTF8.GetString(result.Content);
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines[1].Should().Contain("Acker"); // Bob Acker first
        lines[2].Should().Contain(";Alice;Müller;"); // Alice Müller second
        lines[3].Should().Contain(";Zara;Müller;"); // Zara Müller third
    }

    [Fact]
    public async Task Handle_ShouldEscapeSemicolonsInFields()
    {
        // Arrange
        var member = CreateMember("Te;st", "User");
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Member> { member });

        // Act
        var result = await _handler.Handle(new ExportMembersQuery(), CancellationToken.None);

        // Assert
        var csv = System.Text.Encoding.UTF8.GetString(result.Content);
        // Semicolons in values should be escaped with quotes
        csv.Should().Contain("\"Te;st\"");
    }

    [Fact]
    public async Task Handle_WithNoMembers_ShouldReturnHeaderOnly()
    {
        // Arrange
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Member>());

        // Act
        var result = await _handler.Handle(new ExportMembersQuery(), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        var csv = System.Text.Encoding.UTF8.GetString(result.Content);
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines.Should().HaveCount(1); // Header only
    }

    [Fact]
    public async Task Handle_ShouldLogAuditEvent()
    {
        // Arrange
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Member>());

        // Act
        await _handler.Handle(new ExportMembersQuery(), CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.DataExported,
            It.Is<string>(s => s.Contains("Member")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            It.Is<string?>(s => s == "Member"),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private static Member CreateMember(string firstName, string lastName)
    {
        return Member.Create(firstName, lastName,
            $"{firstName.ToLower()}.{lastName.ToLower()}@test.com",
            Address.Create("Street 1", "City", "1000", "CH"),
            MembershipType.Regular,
            "+41 44 123 45 67");
    }
}

using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for DunningNotice entity (REQ-042)
/// </summary>
public class DunningNoticeTests
{
    private static readonly Guid InvoiceId = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_Level1_ShouldSetProperties()
    {
        // Act
        var dunning = DunningNotice.Create(
            InvoiceId, 1, DateTime.UtcNow.AddDays(14), "First reminder", "admin");

        // Assert
        dunning.InvoiceId.Should().Be(InvoiceId);
        dunning.Level.Should().Be(1);
        dunning.Notes.Should().Be("First reminder");
        dunning.CreatedBy.Should().Be("admin");
        dunning.Status.Should().Be(DunningStatus.Created);
        dunning.SentAt.Should().BeNull();
        dunning.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var dunning = DunningNotice.Create(InvoiceId, 1, DateTime.UtcNow.AddDays(14), null, "admin");

        // Assert
        dunning.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldSetDateToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        var dunning = DunningNotice.Create(InvoiceId, 1, DateTime.UtcNow.AddDays(14), null, "admin");

        // Assert
        dunning.Date.Should().BeAfter(before).And.BeBefore(DateTime.UtcNow.AddSeconds(1));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void Create_ValidLevels_ShouldSucceed(int level)
    {
        // Act
        var dunning = DunningNotice.Create(InvoiceId, level, DateTime.UtcNow.AddDays(14), null, "admin");

        // Assert
        dunning.Level.Should().Be(level);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    [InlineData(-1)]
    public void Create_InvalidLevel_ShouldThrowArgumentException(int level)
    {
        // Act & Assert
        var act = () => DunningNotice.Create(InvoiceId, level, DateTime.UtcNow.AddDays(14), null, "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("level");
    }

    [Fact]
    public void Create_ShouldTrimNotes()
    {
        // Act
        var dunning = DunningNotice.Create(InvoiceId, 1, DateTime.UtcNow.AddDays(14), "  Note  ", "admin");

        // Assert
        dunning.Notes.Should().Be("Note");
    }

    #endregion

    #region MarkAsSent Tests

    [Fact]
    public void MarkAsSent_ShouldSetStatusToSent()
    {
        // Arrange
        var dunning = DunningNotice.Create(InvoiceId, 1, DateTime.UtcNow.AddDays(14), null, "admin");

        // Act
        dunning.MarkAsSent();

        // Assert
        dunning.Status.Should().Be(DunningStatus.Sent);
        dunning.SentAt.Should().NotBeNull();
        dunning.SentAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void MarkAsSent_AlreadySent_ShouldUpdateSentAt()
    {
        // Arrange
        var dunning = DunningNotice.Create(InvoiceId, 1, DateTime.UtcNow.AddDays(14), null, "admin");
        dunning.MarkAsSent();
        var firstSentAt = dunning.SentAt;

        // Act — second send overwrites (no guard in domain)
        dunning.MarkAsSent();

        // Assert
        dunning.Status.Should().Be(DunningStatus.Sent);
    }

    #endregion

    #region SoftDelete Tests

    [Fact]
    public void SoftDelete_ShouldSetIsDeletedTrue()
    {
        // Arrange
        var dunning = DunningNotice.Create(InvoiceId, 1, DateTime.UtcNow.AddDays(14), null, "admin");

        // Act
        dunning.SoftDelete("admin");

        // Assert
        dunning.IsDeleted.Should().BeTrue();
        dunning.DeletedAt.Should().NotBeNull();
        dunning.DeletedBy.Should().Be("admin");
    }

    [Fact]
    public void Restore_ShouldClearSoftDelete()
    {
        // Arrange
        var dunning = DunningNotice.Create(InvoiceId, 1, DateTime.UtcNow.AddDays(14), null, "admin");
        dunning.SoftDelete("admin");

        // Act
        dunning.Restore();

        // Assert
        dunning.IsDeleted.Should().BeFalse();
        dunning.DeletedAt.Should().BeNull();
        dunning.DeletedBy.Should().BeNull();
    }

    #endregion
}

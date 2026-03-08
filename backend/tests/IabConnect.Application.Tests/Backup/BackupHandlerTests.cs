using FluentAssertions;
using IabConnect.Application.Backup;
using IabConnect.Domain.Operations;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Backup;

/// <summary>
/// REQ-053: Unit tests for Backup command/query handlers.
/// </summary>
public class BackupHandlerTests
{
    private readonly Mock<IBackupService> _backupService = new();

    [Fact]
    public async Task CreateBackup_CallsService_ReturnsDto()
    {
        var record = BackupRecord.Create(BackupType.Manual, "admin", "Test backup");
        record.MarkCompleted(1024);

        _backupService
            .Setup(s => s.CreateBackupAsync("admin", "Test backup", It.IsAny<CancellationToken>()))
            .ReturnsAsync(record);

        var handler = new CreateBackupCommandHandler(_backupService.Object);
        var result = await handler.Handle(new CreateBackupCommand("admin", "Test backup"), CancellationToken.None);

        result.Should().NotBeNull();
        result.Status.Should().Be("Completed");
        result.FileSizeBytes.Should().Be(1024);
        result.CreatedBy.Should().Be("admin");
    }

    [Fact]
    public async Task GetBackups_ReturnsListOfDtos()
    {
        var records = new List<BackupRecord>
        {
            BackupRecord.Create(BackupType.Manual, "admin1"),
            BackupRecord.Create(BackupType.Scheduled, "system")
        };

        _backupService
            .Setup(s => s.GetBackupsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(records);

        var handler = new GetBackupsQueryHandler(_backupService.Object);
        var result = await handler.Handle(new GetBackupsQuery(), CancellationToken.None);

        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetBackupById_Found_ReturnsDto()
    {
        var record = BackupRecord.Create(BackupType.Manual, "admin");
        _backupService
            .Setup(s => s.GetBackupByIdAsync(record.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(record);

        var handler = new GetBackupByIdQueryHandler(_backupService.Object);
        var result = await handler.Handle(new GetBackupByIdQuery(record.Id), CancellationToken.None);

        result.Should().NotBeNull();
        result!.Id.Should().Be(record.Id);
    }

    [Fact]
    public async Task GetBackupById_NotFound_ReturnsNull()
    {
        _backupService
            .Setup(s => s.GetBackupByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((BackupRecord?)null);

        var handler = new GetBackupByIdQueryHandler(_backupService.Object);
        var result = await handler.Handle(new GetBackupByIdQuery(Guid.NewGuid()), CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task DeleteBackup_Existing_ReturnsTrue()
    {
        _backupService
            .Setup(s => s.DeleteBackupAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var handler = new DeleteBackupCommandHandler(_backupService.Object);
        var result = await handler.Handle(new DeleteBackupCommand(Guid.NewGuid()), CancellationToken.None);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteBackup_NotFound_ReturnsFalse()
    {
        _backupService
            .Setup(s => s.DeleteBackupAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var handler = new DeleteBackupCommandHandler(_backupService.Object);
        var result = await handler.Handle(new DeleteBackupCommand(Guid.NewGuid()), CancellationToken.None);

        result.Should().BeFalse();
    }
}

/// <summary>
/// REQ-053: Unit tests for BackupRecord domain entity.
/// </summary>
public class BackupRecordTests
{
    [Fact]
    public void Create_SetsCorrectDefaults()
    {
        var record = BackupRecord.Create(BackupType.Manual, "testuser", "notes");

        record.Id.Should().NotBeEmpty();
        record.FileName.Should().StartWith("iabconnect_backup_");
        record.FileName.Should().EndWith(".sql");
        record.Type.Should().Be(BackupType.Manual);
        record.Status.Should().Be(BackupStatus.InProgress);
        record.CreatedBy.Should().Be("testuser");
        record.Notes.Should().Be("notes");
        record.FileSizeBytes.Should().Be(0);
        record.CompletedAt.Should().BeNull();
    }

    [Fact]
    public void MarkCompleted_SetsStatusAndSize()
    {
        var record = BackupRecord.Create(BackupType.Scheduled, "system");

        record.MarkCompleted(2048);

        record.Status.Should().Be(BackupStatus.Completed);
        record.FileSizeBytes.Should().Be(2048);
        record.CompletedAt.Should().NotBeNull();
    }

    [Fact]
    public void MarkFailed_SetsStatusAndError()
    {
        var record = BackupRecord.Create(BackupType.Manual, "admin");

        record.MarkFailed("pg_dump not found");

        record.Status.Should().Be(BackupStatus.Failed);
        record.ErrorMessage.Should().Be("pg_dump not found");
        record.CompletedAt.Should().NotBeNull();
    }
}

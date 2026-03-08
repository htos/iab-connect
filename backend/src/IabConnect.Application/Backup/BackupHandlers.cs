using MediatR;

namespace IabConnect.Application.Backup;

/// <summary>
/// REQ-053: Handles backup-related commands and queries.
/// </summary>
public sealed class CreateBackupCommandHandler(IBackupService backupService)
    : IRequestHandler<CreateBackupCommand, BackupDto>
{
    public async Task<BackupDto> Handle(CreateBackupCommand request, CancellationToken ct)
    {
        var record = await backupService.CreateBackupAsync(request.CreatedBy, request.Notes, ct);
        return BackupDto.FromEntity(record);
    }
}

public sealed class GetBackupsQueryHandler(IBackupService backupService)
    : IRequestHandler<GetBackupsQuery, List<BackupDto>>
{
    public async Task<List<BackupDto>> Handle(GetBackupsQuery request, CancellationToken ct)
    {
        var records = await backupService.GetBackupsAsync(ct);
        return records.Select(BackupDto.FromEntity).ToList();
    }
}

public sealed class GetBackupByIdQueryHandler(IBackupService backupService)
    : IRequestHandler<GetBackupByIdQuery, BackupDto?>
{
    public async Task<BackupDto?> Handle(GetBackupByIdQuery request, CancellationToken ct)
    {
        var record = await backupService.GetBackupByIdAsync(request.Id, ct);
        return record is null ? null : BackupDto.FromEntity(record);
    }
}

public sealed class DeleteBackupCommandHandler(IBackupService backupService)
    : IRequestHandler<DeleteBackupCommand, bool>
{
    public async Task<bool> Handle(DeleteBackupCommand request, CancellationToken ct)
    {
        return await backupService.DeleteBackupAsync(request.Id, ct);
    }
}

public sealed class RestoreBackupCommandHandler(IBackupService backupService)
    : IRequestHandler<RestoreBackupCommand, BackupDto>
{
    public async Task<BackupDto> Handle(RestoreBackupCommand request, CancellationToken ct)
    {
        var record = await backupService.RestoreBackupAsync(request.Id, request.RestoredBy, ct);
        return BackupDto.FromEntity(record);
    }
}

public sealed class UploadBackupCommandHandler(IBackupService backupService)
    : IRequestHandler<UploadBackupCommand, BackupDto>
{
    public async Task<BackupDto> Handle(UploadBackupCommand request, CancellationToken ct)
    {
        var record = await backupService.UploadBackupAsync(
            request.FileStream, request.FileName, request.UploadedBy, request.Notes, ct);
        return BackupDto.FromEntity(record);
    }
}

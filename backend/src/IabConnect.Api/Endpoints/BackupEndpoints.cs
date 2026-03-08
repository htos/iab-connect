using Hangfire;
using Hangfire.Storage;
using IabConnect.Application.Backup;
using IabConnect.Infrastructure.Backup;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-053: Backup & Restore admin endpoints.
/// </summary>
public static class BackupEndpoints
{
    public static WebApplication MapBackupEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/admin/backups")
            .WithTags("Admin - Backups")
            .RequireAuthorization("RequireAdmin");

        group.MapGet("", GetBackups)
            .WithName("GetBackups")
            .WithSummary("REQ-053: List all database backups");

        group.MapPost("", CreateBackup)
            .WithName("CreateBackup")
            .WithSummary("REQ-053: Create a new database backup");

        group.MapGet("/{id:guid}", GetBackup)
            .WithName("GetBackup")
            .WithSummary("REQ-053: Get a specific backup record");

        group.MapGet("/{id:guid}/download", DownloadBackup)
            .WithName("DownloadBackup")
            .WithSummary("REQ-053: Download a backup file");

        group.MapPost("/{id:guid}/restore", RestoreBackup)
            .WithName("RestoreBackup")
            .WithSummary("REQ-053: Restore database from a backup");

        group.MapPost("/upload", UploadBackup)
            .WithName("UploadBackup")
            .WithSummary("REQ-053: Upload a backup file")
            .DisableAntiforgery();

        group.MapDelete("/{id:guid}", DeleteBackup)
            .WithName("DeleteBackup")
            .WithSummary("REQ-053: Delete a backup record and file");

        group.MapGet("/schedule", GetBackupSchedule)
            .WithName("GetBackupSchedule")
            .WithSummary("REQ-053: Get current backup schedule");

        group.MapPut("/schedule", SetBackupSchedule)
            .WithName("SetBackupSchedule")
            .WithSummary("REQ-053: Configure automated backup schedule");

        group.MapDelete("/schedule", DisableBackupSchedule)
            .WithName("DisableBackupSchedule")
            .WithSummary("REQ-053: Disable automated backups");

        return app;
    }

    private static async Task<IResult> GetBackups(IMediator mediator)
    {
        var result = await mediator.Send(new GetBackupsQuery());
        return Results.Ok(result);
    }

    private static async Task<IResult> CreateBackup(
        HttpContext http,
        IMediator mediator,
        CreateBackupRequest? request)
    {
        var userName = http.User.Identity?.Name ?? "admin";
        var result = await mediator.Send(new CreateBackupCommand(userName, request?.Notes));
        return Results.Created($"/api/v1/admin/backups/{result.Id}", result);
    }

    private static async Task<IResult> GetBackup(Guid id, IMediator mediator)
    {
        var result = await mediator.Send(new GetBackupByIdQuery(id));
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> DownloadBackup(Guid id, IBackupService backupService)
    {
        var file = await backupService.GetBackupFileAsync(id);
        if (file is null) return Results.NotFound();

        var (stream, fileName) = file.Value;
        if (stream is null) return Results.NotFound();

        return Results.File(stream, "application/octet-stream", fileName);
    }

    private static async Task<IResult> RestoreBackup(Guid id, HttpContext http, IMediator mediator)
    {
        var userName = http.User.Identity?.Name ?? "admin";
        try
        {
            var result = await mediator.Send(new RestoreBackupCommand(id, userName));
            return Results.Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> UploadBackup(
        HttpContext http,
        IMediator mediator,
        [FromForm] IFormFile file,
        [FromForm] string? notes = null)
    {
        if (file.Length == 0)
            return Results.BadRequest(new { error = "File is empty." });

        if (file.Length > 500 * 1024 * 1024) // 500 MB limit
            return Results.BadRequest(new { error = "File exceeds 500 MB limit." });

        var userName = http.User.Identity?.Name ?? "admin";
        await using var stream = file.OpenReadStream();
        var result = await mediator.Send(new UploadBackupCommand(stream, file.FileName, userName, notes));
        return Results.Created($"/api/v1/admin/backups/{result.Id}", result);
    }

    private static async Task<IResult> DeleteBackup(Guid id, IMediator mediator)
    {
        var deleted = await mediator.Send(new DeleteBackupCommand(id));
        return deleted ? Results.NoContent() : Results.NotFound();
    }

    private const string ScheduledBackupJobId = "scheduled-database-backup";

    private static IResult GetBackupSchedule(IRecurringJobManager jobManager)
    {
        using var connection = JobStorage.Current.GetConnection();
        var recurringJobs = connection.GetRecurringJobs();
        var job = recurringJobs.FirstOrDefault(j => j.Id == ScheduledBackupJobId);

        if (job is null)
            return Results.Ok(new BackupScheduleDto(false, null));

        return Results.Ok(new BackupScheduleDto(true, job.Cron));
    }

    private static IResult SetBackupSchedule(
        BackupScheduleRequest request,
        IRecurringJobManager jobManager)
    {
        if (string.IsNullOrWhiteSpace(request.CronExpression))
            return Results.BadRequest(new { error = "Cron expression is required." });

        try
        {
            jobManager.AddOrUpdate<ScheduledBackupJob>(
                ScheduledBackupJobId,
                job => job.ExecuteAsync(CancellationToken.None),
                request.CronExpression,
                new RecurringJobOptions { TimeZone = TimeZoneInfo.Local });
        }
        catch (Exception)
        {
            return Results.BadRequest(new { error = "Invalid cron expression." });
        }

        return Results.Ok(new BackupScheduleDto(true, request.CronExpression));
    }

    private static IResult DisableBackupSchedule(IRecurringJobManager jobManager)
    {
        jobManager.RemoveIfExists(ScheduledBackupJobId);
        return Results.Ok(new BackupScheduleDto(false, null));
    }

    private sealed record CreateBackupRequest(string? Notes);
    private sealed record BackupScheduleRequest(string CronExpression);
    private sealed record BackupScheduleDto(bool Enabled, string? CronExpression);
}

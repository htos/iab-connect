using MediatR;

namespace IabConnect.Application.Finance.Accounting;

/// <summary>
/// REQ-084: Command to backfill journal entries for existing transactions/payments
/// when switching from SimpleCash to DoubleEntry mode.
/// </summary>
public sealed record BackfillDoubleEntryCommand : IRequest<BackfillResultDto>
{
    public required DateTime CutOffDate { get; init; }
    public required string UserName { get; init; }
}

/// <summary>
/// Result of the backfill operation.
/// </summary>
public sealed record BackfillResultDto
{
    public int TransactionsProcessed { get; init; }
    public int PaymentsProcessed { get; init; }
    public int JournalEntriesCreated { get; init; }
    public int SkippedAlreadyPosted { get; init; }
    public int ErrorCount { get; init; }
    public IReadOnlyList<BackfillErrorDto> Errors { get; init; } = [];
    public DateTime CutOffDate { get; init; }
    public DateTime ExecutedAt { get; init; }
}

public sealed record BackfillErrorDto
{
    public required string SourceType { get; init; }
    public required Guid SourceId { get; init; }
    public required string Description { get; init; }
    public required string ErrorMessage { get; init; }
}

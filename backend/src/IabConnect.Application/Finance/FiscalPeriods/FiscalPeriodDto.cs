namespace IabConnect.Application.Finance.FiscalPeriods;

public sealed record FiscalPeriodDto(
    Guid Id,
    string Name,
    int Year,
    int Month,
    DateTime StartDate,
    DateTime EndDate,
    string Status,
    DateTime? LockedAt,
    string? LockedBy,
    DateTime? UnlockedAt,
    string? UnlockedBy,
    string? LockNotes,
    decimal? TotalIncome,
    decimal? TotalExpense,
    decimal? ClosingBalance);

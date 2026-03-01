using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.Accounting;

// ─── DTOs ───

public sealed record LedgerAccountDto(
    Guid Id,
    string Number,
    string Name,
    string AccountClass,
    string NormalBalance,
    string? Description,
    bool IsActive,
    Guid? ParentAccountId,
    Guid FinanceProfileId,
    int SortOrder,
    DateTime CreatedAt,
    string CreatedBy,
    DateTime? UpdatedAt,
    string? UpdatedBy);

public sealed record JournalEntryDto(
    Guid Id,
    DateTime Date,
    string Description,
    string? Reference,
    string Status,
    string? SourceType,
    Guid? SourceId,
    Guid? FiscalPeriodId,
    Guid FinanceProfileId,
    Guid? ReversalOfEntryId,
    decimal TotalDebit,
    decimal TotalCredit,
    List<JournalEntryLineDto> Lines,
    DateTime CreatedAt,
    string CreatedBy,
    DateTime? PostedAt,
    string? PostedBy);

public sealed record JournalEntryLineDto(
    Guid Id,
    Guid LedgerAccountId,
    string? LedgerAccountNumber,
    string? LedgerAccountName,
    decimal DebitAmount,
    decimal CreditAmount,
    Guid? TaxCodeId,
    decimal? NetAmount,
    decimal? TaxAmount,
    Guid? ActivityAreaId,
    string? ActivityAreaName);

public sealed record PostingMappingDto(
    Guid Id,
    Guid FinanceProfileId,
    string MappingType,
    Guid SourceId,
    Guid LedgerAccountId,
    string? LedgerAccountNumber,
    string? LedgerAccountName,
    Guid? TaxLedgerAccountId,
    string? TaxLedgerAccountNumber,
    string? TaxLedgerAccountName,
    DateTime CreatedAt,
    string CreatedBy,
    DateTime? UpdatedAt,
    string? UpdatedBy);

// ─── Mapping Helpers ───

public static class AccountingDtoMapper
{
    public static LedgerAccountDto MapToDto(LedgerAccount entity) => new(
        entity.Id,
        entity.Number,
        entity.Name,
        entity.AccountClass.ToString(),
        entity.NormalBalance.ToString(),
        entity.Description,
        entity.IsActive,
        entity.ParentAccountId,
        entity.FinanceProfileId,
        entity.SortOrder,
        entity.CreatedAt,
        entity.CreatedBy,
        entity.UpdatedAt,
        entity.UpdatedBy);

    public static JournalEntryDto MapToDto(JournalEntry entity) => new(
        entity.Id,
        entity.Date,
        entity.Description,
        entity.Reference,
        entity.Status.ToString(),
        entity.SourceType,
        entity.SourceId,
        entity.FiscalPeriodId,
        entity.FinanceProfileId,
        entity.ReversalOfEntryId,
        entity.TotalDebit,
        entity.TotalCredit,
        entity.Lines.Select(MapToDto).ToList(),
        entity.CreatedAt,
        entity.CreatedBy,
        entity.PostedAt,
        entity.PostedBy);

    public static JournalEntryLineDto MapToDto(JournalEntryLine line) => new(
        line.Id,
        line.LedgerAccountId,
        line.LedgerAccount?.Number,
        line.LedgerAccount?.Name,
        line.DebitAmount,
        line.CreditAmount,
        line.TaxCodeId,
        line.NetAmount,
        line.TaxAmount,
        line.ActivityAreaId,
        line.ActivityArea?.Name);

    public static PostingMappingDto MapToDto(PostingMapping entity) => new(
        entity.Id,
        entity.FinanceProfileId,
        entity.MappingType.ToString(),
        entity.SourceId,
        entity.LedgerAccountId,
        entity.LedgerAccount?.Number,
        entity.LedgerAccount?.Name,
        entity.TaxLedgerAccountId,
        entity.TaxLedgerAccount?.Number,
        entity.TaxLedgerAccount?.Name,
        entity.CreatedAt,
        entity.CreatedBy,
        entity.UpdatedAt,
        entity.UpdatedBy);
}

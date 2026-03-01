using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using FluentValidation;
using MediatR;

namespace IabConnect.Application.Finance.Accounting.JournalEntries.Commands;

// ─── Create Manual Journal Entry ───

public sealed record CreateJournalEntryCommand : IRequest<JournalEntryDto>
{
    public required DateTime Date { get; init; }
    public required string Description { get; init; }
    public string? Reference { get; init; }
    public required List<CreateJournalEntryLineItem> Lines { get; init; }
    public required string UserName { get; init; }
}

public sealed record CreateJournalEntryLineItem(
    Guid LedgerAccountId,
    decimal DebitAmount,
    decimal CreditAmount,
    Guid? TaxCodeId = null,
    decimal? NetAmount = null,
    decimal? TaxAmount = null,
    Guid? ActivityAreaId = null);

public sealed class CreateJournalEntryCommandValidator : AbstractValidator<CreateJournalEntryCommand>
{
    public CreateJournalEntryCommandValidator()
    {
        RuleFor(x => x.Date).NotEmpty();
        RuleFor(x => x.Description).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Lines).NotEmpty().Must(lines => lines.Count >= 2)
            .WithMessage("A journal entry must have at least two lines.");
        RuleFor(x => x.UserName).NotEmpty();
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.LedgerAccountId).NotEmpty();
            line.RuleFor(l => l.DebitAmount).GreaterThanOrEqualTo(0);
            line.RuleFor(l => l.CreditAmount).GreaterThanOrEqualTo(0);
            line.RuleFor(l => l)
                .Must(l => l.DebitAmount > 0 || l.CreditAmount > 0)
                .WithMessage("Each line must have either a debit or credit amount.");
            line.RuleFor(l => l)
                .Must(l => !(l.DebitAmount > 0 && l.CreditAmount > 0))
                .WithMessage("A line cannot have both debit and credit amounts.");
        });
    }
}

public sealed class CreateJournalEntryCommandHandler : IRequestHandler<CreateJournalEntryCommand, JournalEntryDto>
{
    private readonly IJournalEntryRepository _repository;
    private readonly IFinanceProfileRepository _profileRepo;
    private readonly IFiscalPeriodService _fiscalPeriodService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateJournalEntryCommandHandler(
        IJournalEntryRepository repository,
        IFinanceProfileRepository profileRepo,
        IFiscalPeriodService fiscalPeriodService,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _profileRepo = profileRepo;
        _fiscalPeriodService = fiscalPeriodService;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<JournalEntryDto> Handle(CreateJournalEntryCommand request, CancellationToken ct)
    {
        // REQ-066: Check fiscal period locking
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(request.Date, ct);

        var profile = await _profileRepo.GetActiveProfileAsync(ct)
            ?? throw new InvalidOperationException("No active finance profile found.");

        if (profile.AccountingMode != AccountingMode.DoubleEntry)
            throw new InvalidOperationException("Double-entry bookkeeping is not enabled. Set AccountingMode to DoubleEntry first.");

        // Determine fiscal period
        var periodRepo = _fiscalPeriodService;
        var entry = JournalEntry.Create(
            date: request.Date,
            description: request.Description,
            financeProfileId: profile.Id,
            createdBy: request.UserName,
            reference: request.Reference);

        foreach (var line in request.Lines)
        {
            entry.AddLine(JournalEntryLine.Create(
                ledgerAccountId: line.LedgerAccountId,
                debitAmount: line.DebitAmount,
                creditAmount: line.CreditAmount,
                taxCodeId: line.TaxCodeId,
                netAmount: line.NetAmount,
                taxAmount: line.TaxAmount,
                activityAreaId: line.ActivityAreaId));
        }

        await _repository.AddAsync(entry, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Journal entry '{entry.Description}' created (Draft)",
            entityType: "JournalEntry",
            entityId: entry.Id.ToString(),
            ct: ct);

        return AccountingDtoMapper.MapToDto(entry);
    }
}

// ─── Post Journal Entry ───

public sealed record PostJournalEntryCommand : IRequest<JournalEntryDto?>
{
    public required Guid Id { get; init; }
    public required string UserName { get; init; }
}

// ─── Update Draft Journal Entry ───

public sealed record UpdateJournalEntryCommand : IRequest<JournalEntryDto?>
{
    public required Guid Id { get; init; }
    public required DateTime Date { get; init; }
    public required string Description { get; init; }
    public string? Reference { get; init; }
    public required List<CreateJournalEntryLineItem> Lines { get; init; }
    public required string UserName { get; init; }
}

public sealed class UpdateJournalEntryCommandValidator : AbstractValidator<UpdateJournalEntryCommand>
{
    public UpdateJournalEntryCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Date).NotEmpty();
        RuleFor(x => x.Description).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Lines).NotEmpty().Must(lines => lines.Count >= 2)
            .WithMessage("A journal entry must have at least two lines.");
        RuleFor(x => x.UserName).NotEmpty();
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.LedgerAccountId).NotEmpty();
            line.RuleFor(l => l.DebitAmount).GreaterThanOrEqualTo(0);
            line.RuleFor(l => l.CreditAmount).GreaterThanOrEqualTo(0);
            line.RuleFor(l => l)
                .Must(l => l.DebitAmount > 0 || l.CreditAmount > 0)
                .WithMessage("Each line must have either a debit or credit amount.");
            line.RuleFor(l => l)
                .Must(l => !(l.DebitAmount > 0 && l.CreditAmount > 0))
                .WithMessage("A line cannot have both debit and credit amounts.");
        });
    }
}

public sealed class UpdateJournalEntryCommandHandler : IRequestHandler<UpdateJournalEntryCommand, JournalEntryDto?>
{
    private readonly IJournalEntryRepository _repository;
    private readonly IFiscalPeriodService _fiscalPeriodService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdateJournalEntryCommandHandler(
        IJournalEntryRepository repository,
        IFiscalPeriodService fiscalPeriodService,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _fiscalPeriodService = fiscalPeriodService;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<JournalEntryDto?> Handle(UpdateJournalEntryCommand request, CancellationToken ct)
    {
        var entry = await _repository.GetByIdWithLinesAsync(request.Id, ct);
        if (entry is null) return null;

        // REQ-066: Check fiscal period locking
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(request.Date, ct);

        // Domain method validates Draft status
        entry.Update(request.Date, request.Description, request.Reference);

        // Replace lines: clear existing and add new ones
        entry.ClearLines();
        foreach (var line in request.Lines)
        {
            entry.AddLine(JournalEntryLine.Create(
                ledgerAccountId: line.LedgerAccountId,
                debitAmount: line.DebitAmount,
                creditAmount: line.CreditAmount,
                taxCodeId: line.TaxCodeId,
                netAmount: line.NetAmount,
                taxAmount: line.TaxAmount,
                activityAreaId: line.ActivityAreaId));
        }

        await _repository.UpdateAsync(entry, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Journal entry '{entry.Description}' updated",
            entityType: "JournalEntry",
            entityId: entry.Id.ToString(),
            ct: ct);

        return AccountingDtoMapper.MapToDto(entry);
    }
}

public sealed class PostJournalEntryCommandHandler : IRequestHandler<PostJournalEntryCommand, JournalEntryDto?>
{
    private readonly IJournalEntryRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public PostJournalEntryCommandHandler(
        IJournalEntryRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<JournalEntryDto?> Handle(PostJournalEntryCommand request, CancellationToken ct)
    {
        var entry = await _repository.GetByIdWithLinesAsync(request.Id, ct);
        if (entry is null) return null;

        // Domain method validates balanced + min 2 lines
        entry.Post(request.UserName);

        await _repository.UpdateAsync(entry, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Journal entry '{entry.Description}' posted",
            entityType: "JournalEntry",
            entityId: entry.Id.ToString(),
            ct: ct);

        return AccountingDtoMapper.MapToDto(entry);
    }
}

// ─── Reverse (Storno) Journal Entry ───

public sealed record ReverseJournalEntryCommand : IRequest<JournalEntryDto?>
{
    public required Guid Id { get; init; }
    public string? Reason { get; init; }
    public required string UserName { get; init; }
}

public sealed class ReverseJournalEntryCommandHandler : IRequestHandler<ReverseJournalEntryCommand, JournalEntryDto?>
{
    private readonly IJournalEntryRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public ReverseJournalEntryCommandHandler(
        IJournalEntryRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<JournalEntryDto?> Handle(ReverseJournalEntryCommand request, CancellationToken ct)
    {
        var entry = await _repository.GetByIdWithLinesAsync(request.Id, ct);
        if (entry is null) return null;

        // Domain method creates reversal + sets original to Reversed
        var reversal = entry.CreateReversal(request.UserName, request.Reason);
        reversal.Post(request.UserName);

        await _repository.AddAsync(reversal, ct);
        await _repository.UpdateAsync(entry, ct); // Original is now Reversed
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Journal entry '{entry.Description}' reversed (Storno)",
            entityType: "JournalEntry",
            entityId: entry.Id.ToString(),
            ct: ct);

        return AccountingDtoMapper.MapToDto(reversal);
    }
}

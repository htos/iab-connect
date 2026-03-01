using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using FluentValidation;
using MediatR;

namespace IabConnect.Application.Finance.Accounting.LedgerAccounts.Commands;

// ─── Create ───

public sealed record CreateLedgerAccountCommand : IRequest<LedgerAccountDto>
{
    public required string Number { get; init; }
    public required string Name { get; init; }
    public required string AccountClass { get; init; }
    public required string NormalBalance { get; init; }
    public string? Description { get; init; }
    public Guid? ParentAccountId { get; init; }
    public int SortOrder { get; init; }
    public required string UserName { get; init; }
}

public sealed class CreateLedgerAccountCommandValidator : AbstractValidator<CreateLedgerAccountCommand>
{
    public CreateLedgerAccountCommandValidator()
    {
        RuleFor(x => x.Number).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(300);
        RuleFor(x => x.AccountClass).NotEmpty().Must(v => Enum.TryParse<LedgerAccountClass>(v, true, out _))
            .WithMessage("AccountClass must be Asset, Liability, Equity, Revenue, or Expense.");
        RuleFor(x => x.NormalBalance).NotEmpty().Must(v => Enum.TryParse<NormalBalance>(v, true, out _))
            .WithMessage("NormalBalance must be Debit or Credit.");
        RuleFor(x => x.UserName).NotEmpty();
    }
}

public sealed class CreateLedgerAccountCommandHandler : IRequestHandler<CreateLedgerAccountCommand, LedgerAccountDto>
{
    private readonly ILedgerAccountRepository _repository;
    private readonly IFinanceProfileRepository _profileRepo;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateLedgerAccountCommandHandler(
        ILedgerAccountRepository repository,
        IFinanceProfileRepository profileRepo,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _profileRepo = profileRepo;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<LedgerAccountDto> Handle(CreateLedgerAccountCommand request, CancellationToken ct)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct)
            ?? throw new InvalidOperationException("No active finance profile found.");

        var accountClass = Enum.Parse<LedgerAccountClass>(request.AccountClass, ignoreCase: true);
        var normalBalance = Enum.Parse<NormalBalance>(request.NormalBalance, ignoreCase: true);

        // Check unique number
        var existing = await _repository.GetByNumberAsync(profile.Id, request.Number, ct);
        if (existing is not null)
            throw new InvalidOperationException($"A ledger account with number '{request.Number}' already exists.");

        var account = LedgerAccount.Create(
            request.Number, request.Name, accountClass, normalBalance,
            profile.Id, request.UserName, request.Description,
            request.ParentAccountId, request.SortOrder);

        await _repository.AddAsync(account, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Ledger account '{account.Number} - {account.Name}' created",
            entityType: "LedgerAccount",
            entityId: account.Id.ToString(),
            ct: ct);

        return AccountingDtoMapper.MapToDto(account);
    }
}

// ─── Update ───

public sealed record UpdateLedgerAccountCommand : IRequest<LedgerAccountDto?>
{
    public required Guid Id { get; init; }
    public required string Number { get; init; }
    public required string Name { get; init; }
    public required string AccountClass { get; init; }
    public required string NormalBalance { get; init; }
    public string? Description { get; init; }
    public Guid? ParentAccountId { get; init; }
    public int SortOrder { get; init; }
    public required string UserName { get; init; }
}

public sealed class UpdateLedgerAccountCommandValidator : AbstractValidator<UpdateLedgerAccountCommand>
{
    public UpdateLedgerAccountCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Number).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(300);
        RuleFor(x => x.AccountClass).NotEmpty().Must(v => Enum.TryParse<LedgerAccountClass>(v, true, out _));
        RuleFor(x => x.NormalBalance).NotEmpty().Must(v => Enum.TryParse<NormalBalance>(v, true, out _));
        RuleFor(x => x.UserName).NotEmpty();
    }
}

public sealed class UpdateLedgerAccountCommandHandler : IRequestHandler<UpdateLedgerAccountCommand, LedgerAccountDto?>
{
    private readonly ILedgerAccountRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdateLedgerAccountCommandHandler(
        ILedgerAccountRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<LedgerAccountDto?> Handle(UpdateLedgerAccountCommand request, CancellationToken ct)
    {
        var account = await _repository.GetByIdAsync(request.Id, ct);
        if (account is null) return null;

        var accountClass = Enum.Parse<LedgerAccountClass>(request.AccountClass, ignoreCase: true);
        var normalBalance = Enum.Parse<NormalBalance>(request.NormalBalance, ignoreCase: true);

        account.Update(
            request.Number, request.Name, accountClass, normalBalance,
            request.UserName, request.Description, request.ParentAccountId, request.SortOrder);

        await _repository.UpdateAsync(account, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Ledger account '{account.Number} - {account.Name}' updated",
            entityType: "LedgerAccount",
            entityId: account.Id.ToString(),
            ct: ct);

        return AccountingDtoMapper.MapToDto(account);
    }
}

// ─── Delete ───

public sealed record DeleteLedgerAccountCommand : IRequest<bool>
{
    public required Guid Id { get; init; }
    public required string UserName { get; init; }
}

public sealed class DeleteLedgerAccountCommandHandler : IRequestHandler<DeleteLedgerAccountCommand, bool>
{
    private readonly ILedgerAccountRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeleteLedgerAccountCommandHandler(
        ILedgerAccountRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(DeleteLedgerAccountCommand request, CancellationToken ct)
    {
        var account = await _repository.GetByIdAsync(request.Id, ct);
        if (account is null) return false;

        await _repository.DeleteAsync(request.Id, request.UserName, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Ledger account '{account.Number} - {account.Name}' soft-deleted",
            entityType: "LedgerAccount",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}

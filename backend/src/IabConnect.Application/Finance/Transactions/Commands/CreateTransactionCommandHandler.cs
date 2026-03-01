using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Accounting;
using IabConnect.Application.Finance.Transactions.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Commands;

public sealed class CreateTransactionCommandHandler : IRequestHandler<CreateTransactionCommand, TransactionDto>
{
    private readonly ITransactionRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;
    private readonly IFiscalPeriodService _fiscalPeriodService;
    private readonly IAccountingPostingService _postingService;

    public CreateTransactionCommandHandler(
        ITransactionRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        IFiscalPeriodService fiscalPeriodService,
        IAccountingPostingService postingService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
        _fiscalPeriodService = fiscalPeriodService;
        _postingService = postingService;
    }

    public async Task<TransactionDto> Handle(CreateTransactionCommand request, CancellationToken ct)
    {
        // REQ-066: Check fiscal period locking
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(request.Date, ct);

        var txType = Enum.Parse<TransactionType>(request.Type, ignoreCase: true);

        var transaction = Transaction.Create(
            request.Date, request.Description, request.Amount, txType,
            request.AccountId, request.CategoryId, request.Reference,
            request.Notes, request.UserName,
            request.TaxCodeId, request.TaxRate, request.ActivityAreaId);

        await _repository.AddAsync(transaction, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        // REQ-077: Auto-post to general ledger if double-entry bookkeeping is enabled
        await _postingService.PostTransactionAsync(transaction, request.UserName, ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Transaction '{transaction.Description}' ({transaction.Amount:N2}) created",
            entityType: "Transaction",
            entityId: transaction.Id.ToString(),
            ct: ct);

        return GetTransactionsQueryHandler.MapToDto(transaction);
    }
}

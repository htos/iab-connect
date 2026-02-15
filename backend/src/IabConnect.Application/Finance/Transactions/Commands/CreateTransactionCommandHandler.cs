using IabConnect.Application.Audit;
using IabConnect.Application.Common;
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

    public CreateTransactionCommandHandler(
        ITransactionRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<TransactionDto> Handle(CreateTransactionCommand request, CancellationToken ct)
    {
        var txType = Enum.Parse<TransactionType>(request.Type, ignoreCase: true);

        var transaction = Transaction.Create(
            request.Date, request.Description, request.Amount, txType,
            request.AccountId, request.CategoryId, request.Reference,
            request.Notes, request.UserName,
            request.TaxCodeId, request.TaxRate);

        await _repository.AddAsync(transaction, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Transaction '{transaction.Description}' ({transaction.Amount:N2}) created",
            entityType: "Transaction",
            entityId: transaction.Id.ToString(),
            ct: ct);

        return GetTransactionsQueryHandler.MapToDto(transaction);
    }
}

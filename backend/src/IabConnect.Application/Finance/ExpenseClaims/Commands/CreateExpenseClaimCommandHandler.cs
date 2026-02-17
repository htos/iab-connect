using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.ExpenseClaims.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class CreateExpenseClaimCommandHandler : IRequestHandler<CreateExpenseClaimCommand, ExpenseClaimDto>
{
    private readonly IExpenseClaimRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateExpenseClaimCommandHandler(
        IExpenseClaimRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<ExpenseClaimDto> Handle(CreateExpenseClaimCommand request, CancellationToken ct)
    {
        var currency = Enum.Parse<FinanceCurrency>(request.Currency, ignoreCase: true);

        var claim = ExpenseClaim.Create(
            request.Title,
            request.Description,
            request.Amount,
            currency,
            request.Date,
            request.ClaimantId,
            request.ClaimantName,
            request.ReceiptId,
            request.UserName);

        await _repository.AddAsync(claim, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Expense claim '{claim.Title}' created ({claim.Amount:N2} {claim.Currency})",
            entityType: "ExpenseClaim",
            entityId: claim.Id.ToString(),
            ct: ct);

        return GetExpenseClaimsQueryHandler.MapToDto(claim);
    }
}

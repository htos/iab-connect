using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Accounts.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Accounts.Commands;

public sealed class DeactivateAccountCommandHandler : IRequestHandler<DeactivateAccountCommand, AccountDto?>
{
    private readonly IAccountRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeactivateAccountCommandHandler(
        IAccountRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<AccountDto?> Handle(DeactivateAccountCommand request, CancellationToken ct)
    {
        var account = await _repository.GetByIdAsync(request.Id, ct);
        if (account is null) return null;

        account.Deactivate();

        await _repository.UpdateAsync(account, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Account '{account.Name}' deactivated",
            entityType: "Account",
            entityId: account.Id.ToString(),
            ct: ct);

        return new AccountDto(
            account.Id, account.Name, account.Number, account.Type.ToString(),
            account.Description, account.IsActive, account.SortOrder,
            account.CreatedAt, account.CreatedBy, account.UpdatedAt, account.UpdatedBy);
    }
}

using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Accounts.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Accounts.Commands;

public sealed class UpdateAccountCommandHandler : IRequestHandler<UpdateAccountCommand, AccountDto?>
{
    private readonly IAccountRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdateAccountCommandHandler(
        IAccountRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<AccountDto?> Handle(UpdateAccountCommand request, CancellationToken ct)
    {
        var account = await _repository.GetByIdAsync(request.Id, ct);
        if (account is null) return null;

        var accountType = Enum.Parse<AccountType>(request.Type, ignoreCase: true);

        account.Update(request.Name, request.Number, accountType,
            request.Description, request.SortOrder, request.UserName);

        await _repository.UpdateAsync(account, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Account '{account.Name}' ({account.Number}) updated",
            entityType: "Account",
            entityId: account.Id.ToString(),
            ct: ct);

        return new AccountDto(account.Id, account.Name, account.Number,
            account.Type.ToString(), account.Description, account.IsActive,
            account.SortOrder, account.CreatedAt, account.CreatedBy,
            account.UpdatedAt, account.UpdatedBy);
    }
}

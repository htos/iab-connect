using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Accounts.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Accounts.Commands;

public sealed class CreateAccountCommandHandler : IRequestHandler<CreateAccountCommand, AccountDto>
{
    private readonly IAccountRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateAccountCommandHandler(
        IAccountRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<AccountDto> Handle(CreateAccountCommand request, CancellationToken ct)
    {
        var accountType = Enum.Parse<AccountType>(request.Type, ignoreCase: true);

        var account = Account.Create(
            request.Name, request.Number, accountType,
            request.Description, request.SortOrder, request.UserName);

        await _repository.AddAsync(account, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Account '{account.Name}' ({account.Number}) created",
            entityType: "Account",
            entityId: account.Id.ToString(),
            ct: ct);

        return new AccountDto(account.Id, account.Name, account.Number,
            account.Type.ToString(), account.Description, account.IsActive,
            account.SortOrder, account.CreatedAt, account.CreatedBy,
            account.UpdatedAt, account.UpdatedBy);
    }
}

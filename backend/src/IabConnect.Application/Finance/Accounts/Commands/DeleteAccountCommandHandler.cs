using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Accounts.Commands;

public sealed class DeleteAccountCommandHandler : IRequestHandler<DeleteAccountCommand, bool>
{
    private readonly IAccountRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeleteAccountCommandHandler(
        IAccountRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(DeleteAccountCommand request, CancellationToken ct)
    {
        var account = await _repository.GetByIdAsync(request.Id, ct);
        if (account is null) return false;

        account.SoftDelete(request.UserName);
        await _repository.UpdateAsync(account, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Account '{account.Name}' soft-deleted",
            entityType: "Account",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}

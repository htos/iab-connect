using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Commands;

public sealed class ResetAllFinanceDataCommandHandler : IRequestHandler<ResetAllFinanceDataCommand, bool>
{
    private readonly IFinanceResetService _resetService;
    private readonly IAuditService _auditService;

    public ResetAllFinanceDataCommandHandler(
        IFinanceResetService resetService,
        IAuditService auditService)
    {
        _resetService = resetService;
        _auditService = auditService;
    }

    public async Task<bool> Handle(ResetAllFinanceDataCommand request, CancellationToken ct)
    {
        var tablesCleared = await _resetService.ResetAllFinanceDataAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Finance reset: all finance data deleted ({tablesCleared} tables cleared) by {request.UserName}",
            success: true,
            entityType: "Finance",
            details: $"Tables cleared: {tablesCleared}",
            ct: ct);

        return true;
    }
}

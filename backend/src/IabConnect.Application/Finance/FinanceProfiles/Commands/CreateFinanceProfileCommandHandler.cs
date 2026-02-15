using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.FinanceProfiles.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.FinanceProfiles.Commands;

public sealed class CreateFinanceProfileCommandHandler
    : IRequestHandler<CreateFinanceProfileCommand, FinanceProfileDto>
{
    private readonly IFinanceProfileRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateFinanceProfileCommandHandler(
        IFinanceProfileRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<FinanceProfileDto> Handle(CreateFinanceProfileCommand request, CancellationToken ct)
    {
        var jurisdiction = Enum.Parse<Jurisdiction>(request.Jurisdiction, ignoreCase: false);
        var currency = Enum.Parse<FinanceCurrency>(request.Currency, ignoreCase: false);
        var vatStatus = Enum.Parse<VatStatus>(request.VatStatus ?? "NotRegistered", ignoreCase: true);

        // Deactivate existing active profile
        var existing = await _repository.GetActiveProfileAsync(ct);
        if (existing is not null)
        {
            var tracked = await _repository.GetByIdAsync(existing.Id, ct);
            if (tracked is not null)
            {
                tracked.Deactivate();
                await _repository.UpdateAsync(tracked, ct);
            }
        }

        var profile = FinanceProfile.Create(
            jurisdiction, request.CountryCode, currency, request.FiscalYearStartMonth,
            request.OrganizationName, request.OrganizationAddress,
            request.OrganizationCity, request.OrganizationPostalCode, request.OrganizationCountry,
            request.OrganizationEmail, request.OrganizationPhone,
            request.OrganizationWebsite, request.OrganizationUid,
            request.BankName, request.BankIban, request.BankBic,
            vatStatus, request.VatNumber);

        await _repository.AddAsync(profile, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Finance profile created (Jurisdiction: {profile.Jurisdiction}, Currency: {profile.Currency})",
            entityType: "FinanceProfile",
            entityId: profile.Id.ToString(),
            ct: ct);

        return GetActiveFinanceProfileQueryHandler.MapToDto(profile);
    }
}

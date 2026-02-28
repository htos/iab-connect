using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Exports.Pain001;

/// <summary>
/// REQ-073: Handles pain.001 validation without generating XML.
/// </summary>
public sealed class ValidatePain001QueryHandler : IRequestHandler<ValidatePain001Query, Pain001ValidationResult>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IFinanceProfileRepository _profileRepository;
    private readonly IPain001Generator _generator;

    public ValidatePain001QueryHandler(
        IPaymentRepository paymentRepository,
        IFinanceProfileRepository profileRepository,
        IPain001Generator generator)
    {
        _paymentRepository = paymentRepository;
        _profileRepository = profileRepository;
        _generator = generator;
    }

    public async Task<Pain001ValidationResult> Handle(ValidatePain001Query request, CancellationToken ct)
    {
        var profile = await _profileRepository.GetActiveProfileAsync(ct);
        if (profile is null)
        {
            return new Pain001ValidationResult
            {
                Errors = { "No active finance profile found." }
            };
        }

        var payments = await _paymentRepository.GetByIdsAsync(request.PaymentIds, ct);

        var executionDate = request.RequestedExecutionDate ?? DateTimeOffset.UtcNow;
        var currency = request.Profile == Pain001Profile.ChSps ? "CHF" : "EUR";

        var config = new Pain001Config
        {
            MessageId = "VALIDATE-ONLY",
            InitiatingPartyName = profile.OrganizationName,
            DebtorName = profile.OrganizationName,
            DebtorIban = profile.BankIban ?? string.Empty,
            DebtorBic = profile.BankBic,
            DebtorStreet = profile.OrganizationAddress,
            DebtorCity = profile.OrganizationCity,
            DebtorPostalCode = profile.OrganizationPostalCode,
            DebtorCountry = profile.OrganizationCountry,
            Currency = currency,
            Profile = request.Profile
        };

        var paymentInfos = ExportPain001QueryHandler.MapPayments(payments, currency, executionDate);

        return _generator.Validate(config, paymentInfos);
    }
}

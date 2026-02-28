using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Exports.Pain001;

/// <summary>
/// REQ-073: Handles pain.001 XML export for approved payments.
/// </summary>
public sealed class ExportPain001QueryHandler : IRequestHandler<ExportPain001Query, Pain001ExportResult>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IFinanceProfileRepository _profileRepository;
    private readonly IPain001Generator _generator;
    private readonly IAuditService _auditService;

    public ExportPain001QueryHandler(
        IPaymentRepository paymentRepository,
        IFinanceProfileRepository profileRepository,
        IPain001Generator generator,
        IAuditService auditService)
    {
        _paymentRepository = paymentRepository;
        _profileRepository = profileRepository;
        _generator = generator;
        _auditService = auditService;
    }

    public async Task<Pain001ExportResult> Handle(ExportPain001Query request, CancellationToken ct)
    {
        // 1. Load finance profile (debtor details)
        var profile = await _profileRepository.GetActiveProfileAsync(ct)
            ?? throw new InvalidOperationException("No active finance profile found. Configure a finance profile before exporting payments.");

        // 2. Load specified payments
        var payments = await _paymentRepository.GetByIdsAsync(request.PaymentIds, ct);

        // 3. Build config
        var executionDate = request.RequestedExecutionDate ?? DateTimeOffset.UtcNow;
        var messageId = $"MSG-{executionDate:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";
        var currency = request.Profile == Pain001Profile.ChSps ? "CHF" : "EUR";

        var config = new Pain001Config
        {
            MessageId = messageId,
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

        // 4. Map payments to Pain001PaymentInfo
        var paymentInfos = MapPayments(payments, currency, executionDate);

        // 5. Validate
        var validation = _generator.Validate(config, paymentInfos);
        if (!validation.IsValid)
        {
            return new Pain001ExportResult
            {
                Xml = string.Empty,
                FileName = string.Empty,
                PaymentCount = 0,
                TotalAmount = 0,
                Validation = validation
            };
        }

        // 6. Generate XML
        var xml = _generator.Generate(config, paymentInfos);

        var totalAmount = paymentInfos.Sum(p => p.Amount);
        var fileName = $"pain001_{executionDate:yyyyMMdd}_{messageId[^8..]}.xml";

        // 7. Audit
        await _auditService.LogActionAsync(
            AuditEventType.FinanceExported,
            $"pain.001 XML exported ({paymentInfos.Count} payments, {totalAmount:F2} {currency})",
            entityType: "Payment",
            details: $"profile={request.Profile}, payments={paymentInfos.Count}, total={totalAmount:F2} {currency}",
            ct: ct);

        return new Pain001ExportResult
        {
            Xml = xml,
            FileName = fileName,
            PaymentCount = paymentInfos.Count,
            TotalAmount = totalAmount,
            Validation = validation
        };
    }

    public static List<Pain001PaymentInfo> MapPayments(
        List<Payment> payments,
        string currency,
        DateTimeOffset executionDate)
    {
        var infos = new List<Pain001PaymentInfo>(payments.Count);
        var counter = 0;

        foreach (var p in payments)
        {
            counter++;
            var endToEndId = $"E2E-{p.Id.ToString("N")[..16].ToUpperInvariant()}";

            // Use invoice recipient info when available
            var creditorName = p.Invoice?.RecipientName ?? "Unknown";
            var creditorAddress = p.Invoice?.RecipientAddress;

            // Parse address into components (best-effort)
            string? street = null;
            string? city = null;
            string? postalCode = null;
            string? country = null;

            if (!string.IsNullOrWhiteSpace(creditorAddress))
            {
                ParseAddress(creditorAddress, out street, out city, out postalCode, out country);
            }

            infos.Add(new Pain001PaymentInfo
            {
                PaymentId = p.Id,
                EndToEndId = endToEndId,
                Amount = p.Amount,
                Currency = currency,
                CreditorName = creditorName,
                CreditorIban = p.Reference ?? string.Empty, // Reference field stores creditor IBAN
                CreditorStreet = street,
                CreditorCity = city,
                CreditorPostalCode = postalCode,
                CreditorCountry = country ?? "CH",
                RemittanceInfo = p.Notes,
                RequestedExecutionDate = executionDate
            });
        }

        return infos;
    }

    /// <summary>
    /// Best-effort address parsing: "Street, PostalCode City" or "Street, City".
    /// </summary>
    public static void ParseAddress(
        string address,
        out string? street,
        out string? city,
        out string? postalCode,
        out string? country)
    {
        street = null;
        city = null;
        postalCode = null;
        country = null;

        var parts = address.Split(',', StringSplitOptions.TrimEntries);
        if (parts.Length >= 2)
        {
            street = parts[0];
            var cityPart = parts[^1].Trim();

            // Try to extract postal code from city part: "8000 Zürich"
            var spaceIndex = cityPart.IndexOf(' ');
            if (spaceIndex > 0)
            {
                var potentialPostalCode = cityPart[..spaceIndex];
                if (potentialPostalCode.All(char.IsDigit) && potentialPostalCode.Length >= 4)
                {
                    postalCode = potentialPostalCode;
                    city = cityPart[(spaceIndex + 1)..];
                }
                else
                {
                    city = cityPart;
                }
            }
            else
            {
                city = cityPart;
            }

            // If there's a third part, it might be the country
            if (parts.Length >= 3)
            {
                var potentialCountry = parts[1].Trim().ToUpperInvariant();
                if (potentialCountry.Length == 2)
                {
                    country = potentialCountry;
                }
            }
        }
        else
        {
            street = address;
        }
    }
}

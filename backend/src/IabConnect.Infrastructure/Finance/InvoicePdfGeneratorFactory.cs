using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-063: Factory that selects the appropriate invoice PDF generator
/// based on the active FinanceProfile's jurisdiction and bank configuration.
///
/// Selection logic:
/// - CH jurisdiction + IBAN configured → <see cref="SwissQrBillInvoiceGenerator"/>
/// - All other cases → <see cref="QuestPdfInvoiceGenerator"/>
///
/// This pattern supports adding jurisdiction-specific generators
/// (e.g., EU SEPA templates for REQ-064) without modifying existing code.
/// </summary>
public class InvoicePdfGeneratorFactory : IInvoicePdfGeneratorFactory
{
    private readonly IFinanceProfileRepository _profileRepository;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<InvoicePdfGeneratorFactory> _logger;

    public InvoicePdfGeneratorFactory(
        IFinanceProfileRepository profileRepository,
        IServiceProvider serviceProvider,
        ILogger<InvoicePdfGeneratorFactory> logger)
    {
        _profileRepository = profileRepository;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task<IInvoicePdfGenerator> GetGeneratorAsync()
    {
        var profile = await _profileRepository.GetActiveProfileAsync();

        if (profile is { Jurisdiction: Jurisdiction.CH, BankIban: not null and not "" })
        {
            _logger.LogDebug(
                "Selecting SwissQrBillInvoiceGenerator for CH jurisdiction (IBAN: {Iban})",
                profile.BankIban[..^4] + "****");
            return _serviceProvider.GetRequiredService<SwissQrBillInvoiceGenerator>();
        }

        _logger.LogDebug("Selecting base QuestPdfInvoiceGenerator (Jurisdiction: {Jurisdiction})",
            profile?.Jurisdiction.ToString() ?? "none");
        return _serviceProvider.GetRequiredService<QuestPdfInvoiceGenerator>();
    }
}

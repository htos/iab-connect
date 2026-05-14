using System.Net;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using IabConnect.Domain.Members;
using IabConnect.Domain.Sponsors;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Email;

/// <summary>
/// TECH-003: Sends dunning notification emails by resolving recipient email
/// from Member/Sponsor/Supplier and creating level-appropriate HTML content.
/// </summary>
public sealed class DunningEmailService : IDunningEmailService
{
    private readonly IEmailSender _emailSender;
    private readonly SmtpSettings _smtpSettings;
    private readonly IMemberRepository _memberRepository;
    private readonly ISponsorRepository _sponsorRepository;
    private readonly ISupplierRepository _supplierRepository;
    private readonly ISystemSettingsRepository _settingsRepository;
    private readonly ILogger<DunningEmailService> _logger;

    public DunningEmailService(
        IEmailSender emailSender,
        IOptions<SmtpSettings> smtpSettings,
        IMemberRepository memberRepository,
        ISponsorRepository sponsorRepository,
        ISupplierRepository supplierRepository,
        ISystemSettingsRepository settingsRepository,
        ILogger<DunningEmailService> logger)
    {
        _emailSender = emailSender;
        _smtpSettings = smtpSettings.Value;
        _memberRepository = memberRepository;
        _sponsorRepository = sponsorRepository;
        _supplierRepository = supplierRepository;
        _settingsRepository = settingsRepository;
        _logger = logger;
    }

    public async Task<bool> SendDunningEmailAsync(DunningNotice notice, Invoice invoice, CancellationToken ct = default)
    {
        var recipientEmail = await ResolveRecipientEmailAsync(invoice, ct);
        if (string.IsNullOrWhiteSpace(recipientEmail))
        {
            _logger.LogWarning(
                "Cannot send dunning email for invoice {InvoiceNumber}: no email found for {RecipientType} recipient {RecipientName}",
                invoice.InvoiceNumber, invoice.RecipientType, invoice.RecipientName);
            return false;
        }

        var appName = (await _settingsRepository.GetSettingsAsync(ct)).ApplicationName;
        var subject = BuildSubject(notice.Level, invoice.InvoiceNumber);
        var htmlContent = BuildHtmlContent(notice, invoice, appName);
        var plainText = BuildPlainTextContent(notice, invoice);

        await _emailSender.SendAsync(
            recipientEmail,
            subject,
            htmlContent,
            plainText,
            _smtpSettings.FromName,
            _smtpSettings.FromEmail,
            ct);

        _logger.LogInformation(
            "Dunning email (level {Level}) sent to {Email} for invoice {InvoiceNumber}",
            notice.Level, recipientEmail, invoice.InvoiceNumber);

        return true;
    }

    private async Task<string?> ResolveRecipientEmailAsync(Invoice invoice, CancellationToken ct)
    {
        if (invoice.RecipientId is null)
            return null;

        return invoice.RecipientType switch
        {
            RecipientType.Member => (await _memberRepository.GetByIdAsync(invoice.RecipientId.Value, ct))?.Email,
            RecipientType.Sponsor => (await _sponsorRepository.GetByIdAsync(invoice.RecipientId.Value, ct))?.Email,
            RecipientType.Vendor => (await _supplierRepository.GetByIdAsync(invoice.RecipientId.Value, ct))?.Email,
            _ => null
        };
    }

    private static string BuildSubject(int level, string invoiceNumber) => level switch
    {
        1 => $"Payment Reminder – Invoice {invoiceNumber}",
        2 => $"Second Reminder – Invoice {invoiceNumber}",
        3 => $"Final Notice – Invoice {invoiceNumber}",
        _ => $"Payment Reminder – Invoice {invoiceNumber}"
    };

    private static string BuildHtmlContent(DunningNotice notice, Invoice invoice, string appName)
    {
        var (heading, message) = GetLevelContent(notice.Level);
        var dueDate = invoice.DueDate.ToString("dd/MM/yyyy");
        var newDueDate = notice.DueDate.ToString("dd/MM/yyyy");

        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #EA580C; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">{WebUtility.HtmlEncode(appName)}</h1>
                </div>
                <div style="border: 1px solid #E5E7EB; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #111827; margin-top: 0;">{heading}</h2>
                    <p style="color: #4B5563;">Dear {invoice.RecipientName},</p>
                    <p style="color: #4B5563;">{message}</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Invoice Number</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{invoice.InvoiceNumber}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Amount Due</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{invoice.Total:N2}</td>
                        </tr>
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Original Due Date</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{dueDate}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">New Due Date</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{newDueDate}</td>
                        </tr>
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Dunning Level</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{notice.Level} of 3</td>
                        </tr>
                    </table>
                    {(string.IsNullOrWhiteSpace(notice.Notes) ? "" : $"<p style=\"color: #4B5563;\"><strong>Note:</strong> {notice.Notes}</p>")}
                    <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                        If you have already made this payment, please disregard this notice.
                        For questions, please contact us at the association office.
                    </p>
                </div>
            </body>
            </html>
            """;
    }

    private static string BuildPlainTextContent(DunningNotice notice, Invoice invoice)
    {
        var (heading, message) = GetLevelContent(notice.Level);
        var dueDate = invoice.DueDate.ToString("dd/MM/yyyy");
        var newDueDate = notice.DueDate.ToString("dd/MM/yyyy");

        return $"""
            {heading}

            Dear {invoice.RecipientName},

            {message}

            Invoice Number: {invoice.InvoiceNumber}
            Amount Due: {invoice.Total:N2}
            Original Due Date: {dueDate}
            New Due Date: {newDueDate}
            Dunning Level: {notice.Level} of 3
            {(string.IsNullOrWhiteSpace(notice.Notes) ? "" : $"\nNote: {notice.Notes}")}

            If you have already made this payment, please disregard this notice.
            For questions, please contact us at the association office.
            """;
    }

    private static (string Heading, string Message) GetLevelContent(int level) => level switch
    {
        1 => ("Payment Reminder",
              "We would like to kindly remind you that the following invoice is past due. Please arrange payment at your earliest convenience."),
        2 => ("Second Payment Reminder",
              "Despite our previous reminder, the following invoice remains unpaid. We kindly ask you to settle the outstanding amount promptly."),
        3 => ("Final Payment Notice",
              "This is our final reminder regarding the outstanding invoice below. Please arrange immediate payment to avoid further action."),
        _ => ("Payment Reminder",
              "We would like to kindly remind you that the following invoice is past due. Please arrange payment at your earliest convenience.")
    };
}

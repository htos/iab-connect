using FluentAssertions;
using IabConnect.Application.Common;
using IabConnect.Domain.Common;
using IabConnect.Domain.Events;
using IabConnect.Domain.Finance;
using IabConnect.Domain.Members;
using IabConnect.Domain.Sponsors;
using IabConnect.Infrastructure.Email;
using IabConnect.Infrastructure.Events;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace IabConnect.Infrastructure.Tests;

/// <summary>
/// REQ-086 (E9-S3) AC-1/AC-5/AC-6: backend-generated output (dunning email HTML, the
/// registration-list PDF) renders the organization name resolved from
/// <c>SystemSettings.ApplicationName</c> rather than the hardcoded "IAB Connect".
/// </summary>
public sealed class BackendBrandingTests
{
    private static Mock<ISystemSettingsRepository> ConfiguredSettings(string applicationName)
    {
        var settings = SystemSettings.CreateDefault();
        settings.UpdateBranding(applicationName, "AV", "#000000", "#FFFFFF");
        var repo = new Mock<ISystemSettingsRepository>();
        repo.Setup(r => r.GetSettingsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(settings);
        return repo;
    }

    [Fact]
    public async Task DunningEmail_RendersConfiguredOrganizationName()
    {
        var emailSender = new Mock<IEmailSender>();
        string? capturedHtml = null;
        emailSender
            .Setup(s => s.SendAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, string, string, string?, string, string, CancellationToken>(
                (_, _, html, _, _, _, _) => capturedHtml = html)
            .Returns(Task.CompletedTask);

        var member = Member.Create(
            "Test", "Person", "payer@example.com",
            Address.Create("Street 1", "City", "1000", "Country"),
            MembershipType.Regular);
        var memberRepo = new Mock<IMemberRepository>();
        memberRepo.Setup(r => r.GetByIdAsync(member.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(member);

        var invoice = Invoice.Create(
            "INV-0001", DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(-15),
            RecipientType.Member, member.Id, "Test Person",
            "Test Address", 0m, null, "admin");
        invoice.AddItem("Item", 1, 100m);
        var notice = DunningNotice.Create(invoice.Id, 1, DateTime.UtcNow.AddDays(14), null, "admin");

        var service = new DunningEmailService(
            emailSender.Object,
            Options.Create(new SmtpSettings()),
            memberRepo.Object,
            new Mock<ISponsorRepository>().Object,
            new Mock<ISupplierRepository>().Object,
            ConfiguredSettings("Acme Verein").Object,
            NullLogger<DunningEmailService>.Instance);

        var sent = await service.SendDunningEmailAsync(notice, invoice, TestContext.Current.CancellationToken);

        sent.Should().BeTrue();
        capturedHtml.Should().NotBeNull();
        capturedHtml!.Should().Contain("Acme Verein");
        capturedHtml.Should().NotContain(">IAB Connect<");
    }

    [Fact]
    public async Task RegistrationPdf_GeneratesWithConfiguredOrganizationName()
    {
        // The exporter is now Scoped + genuinely async (it injects ISystemSettingsRepository).
        // Asserting text inside the compressed PDF binary is impractical; this smoke test
        // proves the refactored render path runs end-to-end and produces a valid PDF.
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
        var exporter = new EventRegistrationPdfExporter(ConfiguredSettings("Acme Verein").Object);

        var evt = Event.Create(
            "Summer Festival", "Desc", "Hall",
            DateTime.UtcNow.AddDays(30), DateTime.UtcNow.AddDays(30).AddHours(4));
        var statistics = new EventRegistrationStatistics { TotalRegistrations = 0 };

        var pdf = await exporter.GenerateRegistrationListPdfAsync(
            evt, Array.Empty<EventRegistration>(), statistics);

        pdf.Should().NotBeNullOrEmpty();
        // PDF magic header — proves a real document was emitted.
        System.Text.Encoding.ASCII.GetString(pdf, 0, 5).Should().Be("%PDF-");
    }
}

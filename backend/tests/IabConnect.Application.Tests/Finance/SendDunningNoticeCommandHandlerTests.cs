using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.DunningNotices.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// TECH-003: Unit tests for SendDunningNoticeCommandHandler with email integration.
/// </summary>
public class SendDunningNoticeCommandHandlerTests
{
    private readonly Mock<IDunningNoticeRepository> _dunningRepository = new();
    private readonly Mock<IInvoiceRepository> _invoiceRepository = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly Mock<IDunningEmailService> _dunningEmailService = new();
    private readonly Mock<ILogger<SendDunningNoticeCommandHandler>> _logger = new();
    private readonly SendDunningNoticeCommandHandler _handler;

    public SendDunningNoticeCommandHandlerTests()
    {
        _handler = new SendDunningNoticeCommandHandler(
            _dunningRepository.Object,
            _invoiceRepository.Object,
            _unitOfWork.Object,
            _auditService.Object,
            _dunningEmailService.Object,
            _logger.Object);
    }

    [Fact]
    public async Task Handle_NoticeNotFound_ReturnsNull()
    {
        _dunningRepository.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DunningNotice?)null);

        var result = await _handler.Handle(new SendDunningNoticeCommand(Guid.NewGuid()), CancellationToken.None);

        result.Should().BeNull();
        _dunningEmailService.Verify(s => s.SendDunningEmailAsync(
            It.IsAny<DunningNotice>(), It.IsAny<Invoice>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_InvoiceNotFound_ReturnsNull()
    {
        var notice = CreateNotice();
        _dunningRepository.Setup(r => r.GetByIdAsync(notice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notice);
        _invoiceRepository.Setup(r => r.GetByIdAsync(notice.InvoiceId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Invoice?)null);

        var result = await _handler.Handle(new SendDunningNoticeCommand(notice.Id), CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task Handle_EmailSentSuccessfully_MarksAsSentAndReturnsDto()
    {
        var notice = CreateNotice();
        var invoice = CreateInvoice(notice.InvoiceId);

        _dunningRepository.Setup(r => r.GetByIdAsync(notice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notice);
        _invoiceRepository.Setup(r => r.GetByIdAsync(notice.InvoiceId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        _dunningEmailService.Setup(s => s.SendDunningEmailAsync(notice, invoice, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await _handler.Handle(new SendDunningNoticeCommand(notice.Id), CancellationToken.None);

        result.Should().NotBeNull();
        result!.Status.Should().Be("Sent");
        notice.Status.Should().Be(DunningStatus.Sent);
        notice.SentAt.Should().NotBeNull();

        _dunningEmailService.Verify(s => s.SendDunningEmailAsync(notice, invoice, It.IsAny<CancellationToken>()), Times.Once);
        _dunningRepository.Verify(r => r.UpdateAsync(notice, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            It.Is<string>(s => s.Contains("sent via email")),
            It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_EmailNotResolvable_StillMarksAsSentWithWarning()
    {
        var notice = CreateNotice();
        var invoice = CreateInvoice(notice.InvoiceId);

        _dunningRepository.Setup(r => r.GetByIdAsync(notice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notice);
        _invoiceRepository.Setup(r => r.GetByIdAsync(notice.InvoiceId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        _dunningEmailService.Setup(s => s.SendDunningEmailAsync(notice, invoice, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await _handler.Handle(new SendDunningNoticeCommand(notice.Id), CancellationToken.None);

        result.Should().NotBeNull();
        result!.Status.Should().Be("Sent");
        notice.Status.Should().Be(DunningStatus.Sent);

        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            It.Is<string>(s => s.Contains("no email")),
            It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    private static DunningNotice CreateNotice(int level = 1)
    {
        return DunningNotice.Create(
            Guid.NewGuid(), level, DateTime.UtcNow.AddDays(14), "Test notice", "admin");
    }

    private static Invoice CreateInvoice(Guid? withInvoiceId = null)
    {
        return Invoice.Create(
            "INV-2026-0001", DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(-14),
            RecipientType.Member, Guid.NewGuid(), "Test Member", "Test Address",
            0.081m, null, "admin");
    }
}

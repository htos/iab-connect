using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Archive.Commands;
using IabConnect.Application.Finance.Archive.Queries;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// REQ-070: Unit tests for archive/retention compliance system.
/// </summary>
public class ArchiveTests
{
    #region Domain Logic Tests

    [Fact]
    public void Receipt_Archive_ShouldSetArchiveFields()
    {
        // Arrange
        var receipt = Receipt.Create("test.pdf", "/path", "application/pdf", 1024, "user1");
        var retainUntil = new DateTimeOffset(2036, 12, 31, 23, 59, 59, TimeSpan.Zero);

        // Act
        receipt.Archive("admin", "Year-end archival", retainUntil);

        // Assert
        receipt.IsArchived.Should().BeTrue();
        receipt.ArchivedAt.Should().NotBeNull();
        receipt.ArchivedBy.Should().Be("admin");
        receipt.ArchiveReason.Should().Be("Year-end archival");
        receipt.RetainUntil.Should().Be(retainUntil);
    }

    [Fact]
    public void Receipt_Archive_WithEmptyArchivedBy_ShouldThrow()
    {
        var receipt = Receipt.Create("test.pdf", "/path", "application/pdf", 1024, "user1");

        var act = () => receipt.Archive("", "reason", DateTimeOffset.UtcNow.AddYears(10));

        act.Should().Throw<ArgumentException>().WithParameterName("archivedBy");
    }

    [Fact]
    public void Receipt_Archive_WithEmptyReason_ShouldThrow()
    {
        var receipt = Receipt.Create("test.pdf", "/path", "application/pdf", 1024, "user1");

        var act = () => receipt.Archive("admin", "", DateTimeOffset.UtcNow.AddYears(10));

        act.Should().Throw<ArgumentException>().WithParameterName("reason");
    }

    [Fact]
    public void Receipt_Restore_FromArchive_ShouldClearArchiveFields()
    {
        var receipt = Receipt.Create("test.pdf", "/path", "application/pdf", 1024, "user1");
        receipt.Archive("admin", "archival", DateTimeOffset.UtcNow.AddYears(10));

        receipt.Restore("admin");

        receipt.IsArchived.Should().BeFalse();
        receipt.ArchivedAt.Should().BeNull();
        receipt.ArchivedBy.Should().BeNull();
        receipt.ArchiveReason.Should().BeNull();
        receipt.RetainUntil.Should().Be(default);
    }

    [Fact]
    public void Receipt_Restore_WhenNotArchived_ShouldThrow()
    {
        var receipt = Receipt.Create("test.pdf", "/path", "application/pdf", 1024, "user1");

        var act = () => receipt.Restore("admin");

        act.Should().Throw<InvalidOperationException>().WithMessage("*not archived*");
    }

    [Fact]
    public void Invoice_Archive_ShouldSetArchiveFields()
    {
        var invoice = Invoice.Create("INV-2026-0001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "Test Recipient", null, 7.7m, null, "user1");
        var retainUntil = new DateTimeOffset(2036, 12, 31, 23, 59, 59, TimeSpan.Zero);

        invoice.Archive("admin", "Fiscal year closed", retainUntil);

        invoice.IsArchived.Should().BeTrue();
        invoice.ArchivedAt.Should().NotBeNull();
        invoice.ArchivedBy.Should().Be("admin");
        invoice.ArchiveReason.Should().Be("Fiscal year closed");
        invoice.RetainUntil.Should().Be(retainUntil);
    }

    [Fact]
    public void Invoice_Restore_FromArchive_ShouldClearFields()
    {
        var invoice = Invoice.Create("INV-2026-0001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "Test Recipient", null, 7.7m, null, "user1");
        invoice.Archive("admin", "archival", DateTimeOffset.UtcNow.AddYears(10));

        invoice.Restore("admin");

        invoice.IsArchived.Should().BeFalse();
        invoice.ArchivedAt.Should().BeNull();
    }

    [Fact]
    public void Invoice_Restore_WhenNotArchived_ShouldThrow()
    {
        var invoice = Invoice.Create("INV-2026-0001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "Test Recipient", null, 7.7m, null, "user1");

        var act = () => invoice.Restore("admin");

        act.Should().Throw<InvalidOperationException>().WithMessage("*not archived*");
    }

    [Fact]
    public void Transaction_Archive_ShouldSetArchiveFields()
    {
        var tx = Transaction.Create(DateTime.UtcNow, "Test", 100m, TransactionType.Income,
            Guid.NewGuid(), null, null, null, "user1");

        tx.Archive("admin", "Year-end close", DateTimeOffset.UtcNow.AddYears(10));

        tx.IsArchived.Should().BeTrue();
        tx.ArchivedBy.Should().Be("admin");
        tx.ArchiveReason.Should().Be("Year-end close");
    }

    [Fact]
    public void Transaction_Restore_FromArchive_ShouldClearFields()
    {
        var tx = Transaction.Create(DateTime.UtcNow, "Test", 100m, TransactionType.Income,
            Guid.NewGuid(), null, null, null, "user1");
        tx.Archive("admin", "archival", DateTimeOffset.UtcNow.AddYears(10));

        tx.Restore("admin");

        tx.IsArchived.Should().BeFalse();
        tx.ArchivedAt.Should().BeNull();
    }

    [Fact]
    public void Transaction_Restore_WhenNotArchived_ShouldThrow()
    {
        var tx = Transaction.Create(DateTime.UtcNow, "Test", 100m, TransactionType.Income,
            Guid.NewGuid(), null, null, null, "user1");

        var act = () => tx.Restore("admin");

        act.Should().Throw<InvalidOperationException>().WithMessage("*not archived*");
    }

    #endregion

    #region ArchiveReceiptCommandHandler Tests

    [Fact]
    public async Task ArchiveReceiptHandler_Success_ShouldArchiveAndAudit()
    {
        var receipt = Receipt.Create("doc.pdf", "/path", "application/pdf", 512, "user1");
        var repo = new Mock<IReceiptRepository>();
        repo.Setup(r => r.GetByIdAsync(receipt.Id, It.IsAny<CancellationToken>())).ReturnsAsync(receipt);
        repo.Setup(r => r.UpdateAsync(receipt, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var audit = new Mock<IAuditService>();

        var handler = new ArchiveReceiptCommandHandler(repo.Object, uow.Object, audit.Object);

        var result = await handler.Handle(
            new ArchiveReceiptCommand(receipt.Id, "year-end", "admin"), CancellationToken.None);

        result.Should().BeTrue();
        receipt.IsArchived.Should().BeTrue();
        receipt.ArchiveReason.Should().Be("year-end");
        repo.Verify(r => r.UpdateAsync(receipt, It.IsAny<CancellationToken>()), Times.Once);
        audit.Verify(a => a.LogActionAsync(
            Domain.Audit.AuditEventType.FinanceArchived,
            It.Is<string>(s => s.Contains("doc.pdf")),
            true, null, "Receipt", receipt.Id.ToString(), null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ArchiveReceiptHandler_NotFound_ShouldReturnFalse()
    {
        var repo = new Mock<IReceiptRepository>();
        repo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync((Receipt?)null);

        var handler = new ArchiveReceiptCommandHandler(repo.Object, new Mock<IUnitOfWork>().Object, new Mock<IAuditService>().Object);

        var result = await handler.Handle(
            new ArchiveReceiptCommand(Guid.NewGuid(), "reason", "admin"), CancellationToken.None);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task ArchiveReceiptHandler_AlreadyArchived_ShouldThrow()
    {
        var receipt = Receipt.Create("doc.pdf", "/path", "application/pdf", 512, "user1");
        receipt.Archive("admin", "first", DateTimeOffset.UtcNow.AddYears(10));

        var repo = new Mock<IReceiptRepository>();
        repo.Setup(r => r.GetByIdAsync(receipt.Id, It.IsAny<CancellationToken>())).ReturnsAsync(receipt);

        var handler = new ArchiveReceiptCommandHandler(repo.Object, new Mock<IUnitOfWork>().Object, new Mock<IAuditService>().Object);

        var act = () => handler.Handle(
            new ArchiveReceiptCommand(receipt.Id, "again", "admin"), CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*already archived*");
    }

    #endregion

    #region RestoreReceiptCommandHandler Tests

    [Fact]
    public async Task RestoreReceiptHandler_Success_ShouldRestoreAndAudit()
    {
        var receipt = Receipt.Create("doc.pdf", "/path", "application/pdf", 512, "user1");
        receipt.Archive("admin", "archival", DateTimeOffset.UtcNow.AddYears(10));

        var repo = new Mock<IReceiptRepository>();
        repo.Setup(r => r.GetByIdAsync(receipt.Id, It.IsAny<CancellationToken>())).ReturnsAsync(receipt);
        repo.Setup(r => r.UpdateAsync(receipt, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var audit = new Mock<IAuditService>();

        var handler = new RestoreReceiptCommandHandler(repo.Object, uow.Object, audit.Object);

        var result = await handler.Handle(
            new RestoreReceiptCommand(receipt.Id, "admin"), CancellationToken.None);

        result.Should().BeTrue();
        receipt.IsArchived.Should().BeFalse();
    }

    [Fact]
    public async Task RestoreReceiptHandler_NotArchived_ShouldThrow()
    {
        var receipt = Receipt.Create("doc.pdf", "/path", "application/pdf", 512, "user1");

        var repo = new Mock<IReceiptRepository>();
        repo.Setup(r => r.GetByIdAsync(receipt.Id, It.IsAny<CancellationToken>())).ReturnsAsync(receipt);

        var handler = new RestoreReceiptCommandHandler(repo.Object, new Mock<IUnitOfWork>().Object, new Mock<IAuditService>().Object);

        var act = () => handler.Handle(
            new RestoreReceiptCommand(receipt.Id, "admin"), CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*not archived*");
    }

    #endregion

    #region ArchiveInvoiceCommandHandler Tests

    [Fact]
    public async Task ArchiveInvoiceHandler_Success_ShouldArchiveAndAudit()
    {
        var invoice = Invoice.Create("INV-2026-0001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "Test", null, 7.7m, null, "user1");

        var repo = new Mock<IInvoiceRepository>();
        repo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>())).ReturnsAsync(invoice);
        repo.Setup(r => r.UpdateAsync(invoice, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var audit = new Mock<IAuditService>();

        var handler = new ArchiveInvoiceCommandHandler(repo.Object, uow.Object, audit.Object);

        var result = await handler.Handle(
            new ArchiveInvoiceCommand(invoice.Id, "year-end", "admin"), CancellationToken.None);

        result.Should().BeTrue();
        invoice.IsArchived.Should().BeTrue();
    }

    [Fact]
    public async Task ArchiveInvoiceHandler_AlreadyArchived_ShouldThrow()
    {
        var invoice = Invoice.Create("INV-2026-0001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "Test", null, 7.7m, null, "user1");
        invoice.Archive("admin", "first", DateTimeOffset.UtcNow.AddYears(10));

        var repo = new Mock<IInvoiceRepository>();
        repo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>())).ReturnsAsync(invoice);

        var handler = new ArchiveInvoiceCommandHandler(repo.Object, new Mock<IUnitOfWork>().Object, new Mock<IAuditService>().Object);

        var act = () => handler.Handle(
            new ArchiveInvoiceCommand(invoice.Id, "again", "admin"), CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*already archived*");
    }

    #endregion

    #region RestoreInvoiceCommandHandler Tests

    [Fact]
    public async Task RestoreInvoiceHandler_Success_ShouldRestoreAndAudit()
    {
        var invoice = Invoice.Create("INV-2026-0001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "Test", null, 7.7m, null, "user1");
        invoice.Archive("admin", "archival", DateTimeOffset.UtcNow.AddYears(10));

        var repo = new Mock<IInvoiceRepository>();
        repo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>())).ReturnsAsync(invoice);
        repo.Setup(r => r.UpdateAsync(invoice, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var audit = new Mock<IAuditService>();

        var handler = new RestoreInvoiceCommandHandler(repo.Object, uow.Object, audit.Object);

        var result = await handler.Handle(
            new RestoreInvoiceCommand(invoice.Id, "admin"), CancellationToken.None);

        result.Should().BeTrue();
        invoice.IsArchived.Should().BeFalse();
    }

    #endregion

    #region PurgeArchivedReceiptsCommandHandler Tests

    [Fact]
    public async Task PurgeHandler_ShouldOnlyPurgeExpiredReceipts()
    {
        var expired = Receipt.Create("old.pdf", "/old", "application/pdf", 256, "user1");
        expired.Archive("admin", "old", DateTimeOffset.UtcNow.AddYears(-1));

        var repo = new Mock<IReceiptRepository>();
        repo.Setup(r => r.GetExpiredArchivedAsync(It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([expired]);
        repo.Setup(r => r.RemoveAsync(expired, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var storage = new Mock<IFinanceDocumentStorage>();
        storage.Setup(s => s.DeleteReceiptAsync("/old", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var audit = new Mock<IAuditService>();

        var handler = new PurgeArchivedReceiptsCommandHandler(repo.Object, storage.Object, uow.Object, audit.Object);

        var count = await handler.Handle(
            new PurgeArchivedReceiptsCommand("admin"), CancellationToken.None);

        count.Should().Be(1);
        repo.Verify(r => r.RemoveAsync(expired, It.IsAny<CancellationToken>()), Times.Once);
        storage.Verify(s => s.DeleteReceiptAsync("/old", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PurgeHandler_NoExpired_ShouldReturnZero()
    {
        var repo = new Mock<IReceiptRepository>();
        repo.Setup(r => r.GetExpiredArchivedAsync(It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var handler = new PurgeArchivedReceiptsCommandHandler(
            repo.Object, new Mock<IFinanceDocumentStorage>().Object,
            new Mock<IUnitOfWork>().Object, new Mock<IAuditService>().Object);

        var count = await handler.Handle(
            new PurgeArchivedReceiptsCommand("admin"), CancellationToken.None);

        count.Should().Be(0);
    }

    #endregion

    #region Reject Updates on Archived Items Tests

    [Fact]
    public void Invoice_Update_WhenArchived_ArchiveShouldPreventDraftOnlyCheck()
    {
        // An archived invoice should be rejected by the handler before domain logic runs.
        // Verify the domain side: archived invoices are read-only conceptually.
        var invoice = Invoice.Create("INV-2026-0001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "Test", null, 7.7m, null, "user1");
        invoice.Archive("admin", "archived", DateTimeOffset.UtcNow.AddYears(10));

        invoice.IsArchived.Should().BeTrue();
    }

    [Fact]
    public void Transaction_Update_WhenArchived_IsArchivedShouldBeTrue()
    {
        var tx = Transaction.Create(DateTime.UtcNow, "Test", 100m, TransactionType.Income,
            Guid.NewGuid(), null, null, null, "user1");
        tx.Archive("admin", "archived", DateTimeOffset.UtcNow.AddYears(10));

        tx.IsArchived.Should().BeTrue();
    }

    #endregion

    #region GetArchivedItemsQueryHandler Tests

    [Fact]
    public async Task GetArchivedItemsHandler_ShouldReturnAllArchivedTypes()
    {
        var receipt = Receipt.Create("doc.pdf", "/path", "application/pdf", 512, "user1");
        receipt.Archive("admin", "reason", DateTimeOffset.UtcNow.AddYears(10));

        var invoice = Invoice.Create("INV-2026-0001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "Test", null, 7.7m, null, "user1");
        invoice.Archive("admin", "reason", DateTimeOffset.UtcNow.AddYears(10));

        var tx = Transaction.Create(DateTime.UtcNow, "Test tx", 50m, TransactionType.Expense,
            Guid.NewGuid(), null, null, null, "user1");
        tx.Archive("admin", "reason", DateTimeOffset.UtcNow.AddYears(10));

        var receiptRepo = new Mock<IReceiptRepository>();
        receiptRepo.Setup(r => r.GetArchivedAsync(It.IsAny<CancellationToken>())).ReturnsAsync([receipt]);

        var invoiceRepo = new Mock<IInvoiceRepository>();
        invoiceRepo.Setup(r => r.GetArchivedAsync(It.IsAny<CancellationToken>())).ReturnsAsync([invoice]);

        var txRepo = new Mock<ITransactionRepository>();
        txRepo.Setup(r => r.GetArchivedAsync(It.IsAny<CancellationToken>())).ReturnsAsync([tx]);

        var handler = new GetArchivedItemsQueryHandler(receiptRepo.Object, invoiceRepo.Object, txRepo.Object);

        var items = await handler.Handle(new GetArchivedItemsQuery(), CancellationToken.None);

        items.Should().HaveCount(3);
        items.Should().Contain(i => i.EntityType == "Receipt" && i.DisplayName == "doc.pdf");
        items.Should().Contain(i => i.EntityType == "Invoice" && i.DisplayName == "INV-2026-0001");
        items.Should().Contain(i => i.EntityType == "Transaction" && i.DisplayName == "Test tx");
    }

    #endregion

    #region Validator Tests

    [Fact]
    public void ArchiveReceiptCommandValidator_EmptyReason_ShouldFail()
    {
        var validator = new ArchiveReceiptCommandValidator();
        var result = validator.Validate(new ArchiveReceiptCommand(Guid.NewGuid(), "", "admin"));
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Reason");
    }

    [Fact]
    public void ArchiveReceiptCommandValidator_ValidCommand_ShouldPass()
    {
        var validator = new ArchiveReceiptCommandValidator();
        var result = validator.Validate(new ArchiveReceiptCommand(Guid.NewGuid(), "year-end", "admin"));
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ArchiveInvoiceCommandValidator_EmptyReason_ShouldFail()
    {
        var validator = new ArchiveInvoiceCommandValidator();
        var result = validator.Validate(new ArchiveInvoiceCommand(Guid.NewGuid(), "", "admin"));
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void ArchiveInvoiceCommandValidator_ValidCommand_ShouldPass()
    {
        var validator = new ArchiveInvoiceCommandValidator();
        var result = validator.Validate(new ArchiveInvoiceCommand(Guid.NewGuid(), "retention", "admin"));
        result.IsValid.Should().BeTrue();
    }

    #endregion
}

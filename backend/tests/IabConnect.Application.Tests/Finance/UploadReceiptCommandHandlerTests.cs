using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Receipts.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for UploadReceiptCommandHandler (REQ-061)
/// </summary>
public class UploadReceiptCommandHandlerTests
{
    private readonly Mock<IReceiptRepository> _receiptRepo = new();
    private readonly Mock<IFinanceDocumentStorage> _documentStorage = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly UploadReceiptCommandHandler _handler;

    public UploadReceiptCommandHandlerTests()
    {
        _handler = new UploadReceiptCommandHandler(
            _receiptRepo.Object, _documentStorage.Object,
            _unitOfWork.Object, _auditService.Object);
    }

    private static UploadReceiptCommand CreateValidCommand() => new()
    {
        FileName = "invoice.pdf",
        ContentType = "application/pdf",
        FileSize = 1024,
        FileStream = new MemoryStream([0x01, 0x02, 0x03]),
        Notes = "Monthly invoice",
        UserName = "admin"
    };

    [Fact]
    public async Task Handle_ValidFile_ShouldUploadAndCreateReceipt()
    {
        // Arrange
        _documentStorage.Setup(s => s.ValidateFile(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>()))
            .Returns(new ReceiptFileValidationResult(true));
        _documentStorage.Setup(s => s.UploadReceiptAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Stream>(),
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReceiptUploadResult("/storage/path", "sha256-hash", 1024));

        var command = CreateValidCommand();

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.FileName.Should().Be("invoice.pdf");

        _receiptRepo.Verify(r => r.AddAsync(It.IsAny<Receipt>(), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_InvalidFileType_ShouldThrowInvalidOperationException()
    {
        // Arrange
        _documentStorage.Setup(s => s.ValidateFile(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>()))
            .Returns(new ReceiptFileValidationResult(false, "File type not allowed."));

        var command = CreateValidCommand();

        // Act & Assert
        var act = () => _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*File type*");
    }

    [Fact]
    public async Task Handle_OversizedFile_ShouldThrowInvalidOperationException()
    {
        // Arrange
        _documentStorage.Setup(s => s.ValidateFile(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>()))
            .Returns(new ReceiptFileValidationResult(false, "File too large."));

        var command = CreateValidCommand();

        // Act & Assert
        var act = () => _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*too large*");
    }

    [Fact]
    public async Task Handle_ShouldSetStorageMetadataFromUploadResult()
    {
        // Arrange
        _documentStorage.Setup(s => s.ValidateFile(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>()))
            .Returns(new ReceiptFileValidationResult(true));
        _documentStorage.Setup(s => s.UploadReceiptAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Stream>(),
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReceiptUploadResult("/final/path", "computed-hash", 2048));

        Receipt? savedReceipt = null;
        _receiptRepo.Setup(r => r.AddAsync(It.IsAny<Receipt>(), It.IsAny<CancellationToken>()))
            .Callback<Receipt, CancellationToken>((r, _) => savedReceipt = r);

        // Act
        await _handler.Handle(CreateValidCommand(), CancellationToken.None);

        // Assert
        savedReceipt.Should().NotBeNull();
        savedReceipt!.FilePath.Should().Be("/final/path");
        savedReceipt.FileHash.Should().Be("computed-hash");
        savedReceipt.FileSize.Should().Be(2048);
    }

    [Fact]
    public async Task Handle_ShouldLogAuditEvent()
    {
        // Arrange
        _documentStorage.Setup(s => s.ValidateFile(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>()))
            .Returns(new ReceiptFileValidationResult(true));
        _documentStorage.Setup(s => s.UploadReceiptAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Stream>(),
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReceiptUploadResult("/path", "hash", 1024));

        // Act
        await _handler.Handle(CreateValidCommand(), CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceCreated,
            It.Is<string>(s => s.Contains("invoice.pdf")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "Receipt",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}

using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.InvoiceTemplates.Commands;
using IabConnect.Application.Finance.InvoiceTemplates.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for InvoiceTemplate command/query handlers (REQ-064)
/// </summary>
public class InvoiceTemplateHandlerTests
{
    private readonly Mock<IInvoiceTemplateRepository> _templateRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();

    private static InvoiceTemplate CreateTestTemplate(
        Jurisdiction jurisdiction = Jurisdiction.EU,
        string name = "EU Standard") =>
        InvoiceTemplate.Create(
            name, jurisdiction, "DE", true,
            true, false, null, false, null,
            true, "Due within 30 days", true,
            null, null, null, null, "en");

    #region CreateInvoiceTemplateCommandHandler

    [Fact]
    public async Task Should_Create_Template()
    {
        // Arrange
        var handler = new CreateInvoiceTemplateCommandHandler(
            _templateRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new CreateInvoiceTemplateCommand
        {
            Name = "EU Standard",
            Jurisdiction = "EU",
            CountryCode = "DE",
            IsDefault = true,
            ShowVatId = true,
            ShowTaxExemptionNote = false,
            TaxExemptionNote = null,
            ShowReverseChargeNote = false,
            ReverseChargeNote = null,
            ShowPaymentTerms = true,
            DefaultPaymentTerms = "Due within 30 days",
            ShowBankDetails = true,
            Language = "en"
        };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("EU Standard");
        result.Jurisdiction.Should().Be("EU");
        result.CountryCode.Should().Be("DE");
        result.IsDefault.Should().BeTrue();
        result.Language.Should().Be("en");

        _templateRepo.Verify(r => r.AddAsync(It.IsAny<InvoiceTemplate>(), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Should_Audit_Creation()
    {
        // Arrange
        var handler = new CreateInvoiceTemplateCommandHandler(
            _templateRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new CreateInvoiceTemplateCommand
        {
            Name = "CH Template",
            Jurisdiction = "CH",
            Language = "de"
        };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceCreated,
            It.Is<string>(s => s.Contains("CH Template")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "InvoiceTemplate",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region GetInvoiceTemplatesQueryHandler

    [Fact]
    public async Task Should_Return_All_Templates()
    {
        // Arrange
        var templates = new List<InvoiceTemplate>
        {
            CreateTestTemplate(Jurisdiction.EU, "EU Standard"),
            CreateTestTemplate(Jurisdiction.CH, "CH Standard")
        };

        _templateRepo.Setup(r => r.GetAllAsync(null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(templates);

        var handler = new GetInvoiceTemplatesQueryHandler(_templateRepo.Object);
        var query = new GetInvoiceTemplatesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items[0].Name.Should().Be("CH Standard");
        result.Items[1].Name.Should().Be("EU Standard");
    }

    [Fact]
    public async Task Should_Filter_By_Jurisdiction()
    {
        // Arrange
        var templates = new List<InvoiceTemplate>
        {
            CreateTestTemplate(Jurisdiction.EU, "EU Standard")
        };

        _templateRepo.Setup(r => r.GetAllAsync(Jurisdiction.EU, It.IsAny<CancellationToken>()))
            .ReturnsAsync(templates);

        var handler = new GetInvoiceTemplatesQueryHandler(_templateRepo.Object);
        var query = new GetInvoiceTemplatesQuery("EU");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Jurisdiction.Should().Be("EU");

        _templateRepo.Verify(r => r.GetAllAsync(Jurisdiction.EU, It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region DeleteInvoiceTemplateCommandHandler

    [Fact]
    public async Task Should_Delete_Template()
    {
        // Arrange
        var template = CreateTestTemplate();
        _templateRepo.Setup(r => r.GetByIdAsync(template.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(template);

        var handler = new DeleteInvoiceTemplateCommandHandler(
            _templateRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new DeleteInvoiceTemplateCommand(template.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        template.IsDeleted.Should().BeTrue();
        _templateRepo.Verify(r => r.UpdateAsync(template, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Should_Return_False_When_Not_Found()
    {
        // Arrange
        _templateRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((InvoiceTemplate?)null);

        var handler = new DeleteInvoiceTemplateCommandHandler(
            _templateRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new DeleteInvoiceTemplateCommand(Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().BeFalse();
        _templateRepo.Verify(r => r.UpdateAsync(It.IsAny<InvoiceTemplate>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    #endregion
}

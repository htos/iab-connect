using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for InvoiceTemplate entity (REQ-064)
/// </summary>
public class InvoiceTemplateTests
{
    private static InvoiceTemplate CreateValidTemplate(
        string name = "EU Standard",
        Jurisdiction jurisdiction = Jurisdiction.EU,
        string? countryCode = "DE",
        bool isDefault = true,
        string language = "en") =>
        InvoiceTemplate.Create(
            name, jurisdiction, countryCode, isDefault,
            showVatId: true,
            showTaxExemptionNote: false,
            taxExemptionNote: null,
            showReverseChargeNote: false,
            reverseChargeNote: null,
            showPaymentTerms: true,
            defaultPaymentTerms: "Due within 30 days",
            showBankDetails: true,
            logoUrl: "https://example.com/logo.png",
            headerText: "Invoice Header",
            footerText: "Invoice Footer",
            legalNotice: "Registered at...",
            language: language);

    #region InvoiceTemplate_Create

    [Fact]
    public void Should_Create_With_Valid_Data()
    {
        // Act
        var template = CreateValidTemplate();

        // Assert
        template.Name.Should().Be("EU Standard");
        template.Jurisdiction.Should().Be(Jurisdiction.EU);
        template.CountryCode.Should().Be("DE");
        template.IsDefault.Should().BeTrue();
        template.ShowVatId.Should().BeTrue();
        template.ShowTaxExemptionNote.Should().BeFalse();
        template.TaxExemptionNote.Should().BeNull();
        template.ShowReverseChargeNote.Should().BeFalse();
        template.ReverseChargeNote.Should().BeNull();
        template.ShowPaymentTerms.Should().BeTrue();
        template.DefaultPaymentTerms.Should().Be("Due within 30 days");
        template.ShowBankDetails.Should().BeTrue();
        template.LogoUrl.Should().Be("https://example.com/logo.png");
        template.HeaderText.Should().Be("Invoice Header");
        template.FooterText.Should().Be("Invoice Footer");
        template.LegalNotice.Should().Be("Registered at...");
        template.Language.Should().Be("en");
    }

    [Fact]
    public void Should_Set_Default_Values()
    {
        // Act
        var template = CreateValidTemplate();

        // Assert
        template.Id.Should().NotBe(Guid.Empty);
        template.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
        template.UpdatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Should_Throw_When_Name_Empty()
    {
        // Act & Assert
        var act = () => CreateValidTemplate(name: "");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    [Fact]
    public void Should_Trim_And_Uppercase_CountryCode()
    {
        // Act
        var template = CreateValidTemplate(countryCode: " de ");

        // Assert
        template.CountryCode.Should().Be("DE");
    }

    #endregion

    #region InvoiceTemplate_Update

    [Fact]
    public void Should_Update_All_Fields()
    {
        // Arrange
        var template = CreateValidTemplate();

        // Act
        template.Update(
            name: "Updated Template",
            isDefault: false,
            showVatId: false,
            showTaxExemptionNote: true,
            taxExemptionNote: "Tax exempt under §4 UStG",
            showReverseChargeNote: true,
            reverseChargeNote: "Reverse charge applies",
            showPaymentTerms: false,
            defaultPaymentTerms: "Due within 14 days",
            showBankDetails: false,
            logoUrl: "https://example.com/new-logo.png",
            headerText: "New Header",
            footerText: "New Footer",
            legalNotice: "New Legal Notice",
            language: "de");

        // Assert
        template.Name.Should().Be("Updated Template");
        template.IsDefault.Should().BeFalse();
        template.ShowVatId.Should().BeFalse();
        template.ShowTaxExemptionNote.Should().BeTrue();
        template.TaxExemptionNote.Should().Be("Tax exempt under §4 UStG");
        template.ShowReverseChargeNote.Should().BeTrue();
        template.ReverseChargeNote.Should().Be("Reverse charge applies");
        template.ShowPaymentTerms.Should().BeFalse();
        template.DefaultPaymentTerms.Should().Be("Due within 14 days");
        template.ShowBankDetails.Should().BeFalse();
        template.LogoUrl.Should().Be("https://example.com/new-logo.png");
        template.HeaderText.Should().Be("New Header");
        template.FooterText.Should().Be("New Footer");
        template.LegalNotice.Should().Be("New Legal Notice");
        template.Language.Should().Be("de");
    }

    [Fact]
    public void Should_Update_Timestamp()
    {
        // Arrange
        var template = CreateValidTemplate();
        var originalUpdatedAt = template.UpdatedAt;

        // Small delay to ensure timestamp differs
        Thread.Sleep(10);

        // Act
        template.Update(
            name: "Updated",
            isDefault: false,
            showVatId: true,
            showTaxExemptionNote: false,
            taxExemptionNote: null,
            showReverseChargeNote: false,
            reverseChargeNote: null,
            showPaymentTerms: true,
            defaultPaymentTerms: null,
            showBankDetails: true,
            logoUrl: null,
            headerText: null,
            footerText: null,
            legalNotice: null,
            language: "en");

        // Assert
        template.UpdatedAt.Should().BeAfter(originalUpdatedAt);
    }

    #endregion
}

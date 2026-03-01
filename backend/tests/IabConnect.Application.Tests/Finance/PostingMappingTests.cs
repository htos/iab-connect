using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for PostingMapping entity (REQ-077/082)
/// </summary>
public class PostingMappingTests
{
    private static readonly Guid FinanceProfileId = Guid.NewGuid();
    private static readonly Guid SourceId = Guid.NewGuid();
    private static readonly Guid LedgerAccountId = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetAllProperties()
    {
        // Act
        var mapping = PostingMapping.Create(
            financeProfileId: FinanceProfileId,
            mappingType: PostingMappingType.Category,
            sourceId: SourceId,
            ledgerAccountId: LedgerAccountId,
            createdBy: "admin");

        // Assert
        mapping.FinanceProfileId.Should().Be(FinanceProfileId);
        mapping.MappingType.Should().Be(PostingMappingType.Category);
        mapping.SourceId.Should().Be(SourceId);
        mapping.LedgerAccountId.Should().Be(LedgerAccountId);
        mapping.CreatedBy.Should().Be("admin");
        mapping.TaxLedgerAccountId.Should().BeNull();
    }

    [Fact]
    public void Create_WithTaxLedgerAccount_ShouldSetTaxAccount()
    {
        // Arrange
        var taxAccountId = Guid.NewGuid();

        // Act
        var mapping = PostingMapping.Create(
            financeProfileId: FinanceProfileId,
            mappingType: PostingMappingType.TaxCode,
            sourceId: SourceId,
            ledgerAccountId: LedgerAccountId,
            createdBy: "admin",
            taxLedgerAccountId: taxAccountId);

        // Assert
        mapping.TaxLedgerAccountId.Should().Be(taxAccountId);
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var mapping = CreateValidMapping();

        // Assert
        mapping.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldSetCreatedAtToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        var mapping = CreateValidMapping();

        // Assert
        mapping.CreatedAt.Should().BeAfter(before).And.BeBefore(DateTime.UtcNow.AddSeconds(1));
    }

    [Theory]
    [InlineData(PostingMappingType.Category)]
    [InlineData(PostingMappingType.Account)]
    [InlineData(PostingMappingType.TaxCode)]
    public void Create_WithDifferentMappingTypes_ShouldSucceed(PostingMappingType mappingType)
    {
        // Act
        var mapping = PostingMapping.Create(
            financeProfileId: FinanceProfileId,
            mappingType: mappingType,
            sourceId: SourceId,
            ledgerAccountId: LedgerAccountId,
            createdBy: "admin");

        // Assert
        mapping.MappingType.Should().Be(mappingType);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ShouldChangeLedgerAccount()
    {
        // Arrange
        var mapping = CreateValidMapping();
        var newLedgerAccountId = Guid.NewGuid();

        // Act
        mapping.Update(newLedgerAccountId, "admin2");

        // Assert
        mapping.LedgerAccountId.Should().Be(newLedgerAccountId);
        mapping.UpdatedBy.Should().Be("admin2");
        mapping.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void Update_WithTaxLedgerAccount_ShouldUpdateTaxAccount()
    {
        // Arrange
        var mapping = CreateValidMapping();
        var newLedgerAccountId = Guid.NewGuid();
        var newTaxAccountId = Guid.NewGuid();

        // Act
        mapping.Update(newLedgerAccountId, "admin2", newTaxAccountId);

        // Assert
        mapping.LedgerAccountId.Should().Be(newLedgerAccountId);
        mapping.TaxLedgerAccountId.Should().Be(newTaxAccountId);
    }

    [Fact]
    public void Update_ShouldSetUpdatedAtToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);
        var mapping = CreateValidMapping();

        // Act
        mapping.Update(Guid.NewGuid(), "admin2");

        // Assert
        mapping.UpdatedAt.Should().NotBeNull();
        mapping.UpdatedAt!.Value.Should().BeAfter(before).And.BeBefore(DateTime.UtcNow.AddSeconds(1));
    }

    [Fact]
    public void Update_ShouldNotChangeMappingType()
    {
        // Arrange
        var mapping = PostingMapping.Create(
            financeProfileId: FinanceProfileId,
            mappingType: PostingMappingType.Category,
            sourceId: SourceId,
            ledgerAccountId: LedgerAccountId,
            createdBy: "admin");

        // Act
        mapping.Update(Guid.NewGuid(), "admin2");

        // Assert — MappingType, SourceId unchanged
        mapping.MappingType.Should().Be(PostingMappingType.Category);
        mapping.SourceId.Should().Be(SourceId);
        mapping.FinanceProfileId.Should().Be(FinanceProfileId);
    }

    #endregion

    #region Helpers

    private static PostingMapping CreateValidMapping()
    {
        return PostingMapping.Create(
            financeProfileId: FinanceProfileId,
            mappingType: PostingMappingType.Category,
            sourceId: SourceId,
            ledgerAccountId: LedgerAccountId,
            createdBy: "admin");
    }

    #endregion
}

using FluentAssertions;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.BankImports;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Finance;
using Moq;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Finance;

/// <summary>
/// REQ-069: Unit tests for BankImportMatcher auto-matching logic.
/// </summary>
public class BankImportMatcherTests
{
    private readonly Mock<IInvoiceRepository> _invoiceRepoMock = new();
    private readonly BankImportMatcher _sut;

    public BankImportMatcherTests()
    {
        _sut = new BankImportMatcher(_invoiceRepoMock.Object);
    }

    private static BankImportItem CreateItem(
        string? endToEndId = null,
        string? creditorRef = null,
        string? remittanceInfo = null,
        decimal amount = 100m,
        DateTime? date = null,
        BankImportItemStatus status = BankImportItemStatus.Unmatched)
    {
        var item = BankImportItem.Create(
            Guid.NewGuid(),
            date ?? new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
            "Test transaction",
            amount,
            "CH1234567890123456789",
            null);

        item.SetCamtFields(endToEndId, creditorRef, remittanceInfo, null, null);

        if (status != BankImportItemStatus.Unmatched)
        {
            if (status == BankImportItemStatus.Ignored) item.Ignore();
            if (status == BankImportItemStatus.Matched) item.MatchToPayment(Guid.NewGuid());
        }

        return item;
    }

    private static Invoice CreateInvoice(
        string invoiceNumber,
        decimal total = 100m,
        DateTime? dueDate = null)
    {
        var invoice = Invoice.Create(
            invoiceNumber,
            DateTime.UtcNow,
            dueDate ?? new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Utc),
            RecipientType.Member,
            Guid.NewGuid(),
            "Test Recipient",
            null,
            0m,
            null,
            "test");

        // Set total via items
        invoice.AddItem("Test item", 1, total);

        return invoice;
    }

    private void SetupOpenInvoices(params Invoice[] invoices)
    {
        _invoiceRepoMock
            .Setup(r => r.GetOpenItemsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoices.ToList());
    }

    [Fact]
    public async Task Should_Match_By_EndToEndId_With_Full_Confidence()
    {
        var invoice = CreateInvoice("INV-2026-001");
        SetupOpenInvoices(invoice);

        var item = CreateItem(endToEndId: "INV-2026-001");

        var suggestions = await _sut.FindMatchesAsync([item], TestContext.Current.CancellationToken);

        suggestions.Should().HaveCount(1);
        suggestions[0].Confidence.Should().Be(1.0m);
        suggestions[0].InvoiceId.Should().Be(invoice.Id);
    }

    [Fact]
    public async Task Should_Match_By_CreditorReference()
    {
        var invoice = CreateInvoice("INV-2026-002");
        SetupOpenInvoices(invoice);

        var item = CreateItem(creditorRef: "INV-2026-002");

        var suggestions = await _sut.FindMatchesAsync([item], TestContext.Current.CancellationToken);

        suggestions.Should().HaveCount(1);
        suggestions[0].Confidence.Should().Be(0.95m);
    }

    [Fact]
    public async Task Should_Match_By_RemittanceInfo_Contains()
    {
        var invoice = CreateInvoice("INV-2026-003");
        SetupOpenInvoices(invoice);

        var item = CreateItem(remittanceInfo: "Payment for INV-2026-003 from company");

        var suggestions = await _sut.FindMatchesAsync([item], TestContext.Current.CancellationToken);

        suggestions.Should().HaveCount(1);
        suggestions[0].Confidence.Should().Be(0.8m);
    }

    [Fact]
    public async Task Should_Match_By_Amount_And_Date_Proximity()
    {
        var invoice = CreateInvoice("INV-2026-004", total: 250m,
            dueDate: new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Utc));
        SetupOpenInvoices(invoice);

        // Item date within 30 days of due date, same amount
        var item = CreateItem(amount: 250m,
            date: new DateTime(2026, 1, 20, 0, 0, 0, DateTimeKind.Utc));

        var suggestions = await _sut.FindMatchesAsync([item], TestContext.Current.CancellationToken);

        suggestions.Should().HaveCount(1);
        suggestions[0].Confidence.Should().Be(0.6m);
    }

    [Fact]
    public async Task Should_Match_By_Amount_Only_Lower_Confidence()
    {
        var invoice = CreateInvoice("INV-2026-005", total: 300m,
            dueDate: new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        SetupOpenInvoices(invoice);

        // Item date far from due date (> 30 days), but same amount
        var item = CreateItem(amount: 300m,
            date: new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc));

        var suggestions = await _sut.FindMatchesAsync([item], TestContext.Current.CancellationToken);

        suggestions.Should().HaveCount(1);
        suggestions[0].Confidence.Should().Be(0.4m);
    }

    [Fact]
    public async Task Should_Not_Match_When_No_Open_Invoices()
    {
        SetupOpenInvoices(); // empty

        var item = CreateItem(endToEndId: "INV-NONE");

        var suggestions = await _sut.FindMatchesAsync([item], TestContext.Current.CancellationToken);

        suggestions.Should().BeEmpty();
    }

    [Fact]
    public async Task Should_Skip_Already_Matched_Items()
    {
        var invoice = CreateInvoice("INV-2026-006");
        SetupOpenInvoices(invoice);

        var item = CreateItem(
            endToEndId: "INV-2026-006",
            status: BankImportItemStatus.Matched);

        var suggestions = await _sut.FindMatchesAsync([item], TestContext.Current.CancellationToken);

        suggestions.Should().BeEmpty();
    }

    [Fact]
    public async Task Should_Return_Best_Match_When_Multiple()
    {
        // Invoice that matches by remittance AND by amount
        var invoice1 = CreateInvoice("INV-2026-007", total: 100m);
        var invoice2 = CreateInvoice("DIFFERENT", total: 100m);
        SetupOpenInvoices(invoice1, invoice2);

        // EndToEndId matches invoice1 exactly → confidence 1.0 (best)
        var item = CreateItem(endToEndId: "INV-2026-007", amount: 100m);

        var suggestions = await _sut.FindMatchesAsync([item], TestContext.Current.CancellationToken);

        suggestions.Should().HaveCount(1);
        suggestions[0].InvoiceId.Should().Be(invoice1.Id);
        suggestions[0].Confidence.Should().Be(1.0m);
    }
}

using FluentAssertions;
using IabConnect.Application.Finance.BankImports;
using IabConnect.Infrastructure.Finance;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Finance;

/// <summary>
/// REQ-069: Unit tests for CamtParser (camt.053 / camt.054 parsing).
/// </summary>
public class CamtParserTests
{
    private readonly CamtParser _sut = new();

    private static string FixturePath(string filename) =>
        Path.Combine(AppContext.BaseDirectory, "Finance", "Fixtures", filename);

    private static Stream OpenFixture(string filename) =>
        File.OpenRead(FixturePath(filename));

    #region CamtParser_053

    [Fact]
    public async Task Should_Parse_Camt053_MessageId()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        result.MessageId.Should().Be("MSG-2026-001");
    }

    [Fact]
    public async Task Should_Parse_Camt053_StatementId()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        result.StatementId.Should().Be("STMT-2026-001");
    }

    [Fact]
    public async Task Should_Parse_Camt053_AccountIban()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        result.AccountIban.Should().Be("CH9300762011623852957");
    }

    [Fact]
    public async Task Should_Parse_Camt053_Entries_Count()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        result.Entries.Should().HaveCount(3);
    }

    [Fact]
    public async Task Should_Parse_Entry_Amount_And_Currency()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        var first = result.Entries[0];
        first.Amount.Should().Be(150.00m);
        first.Currency.Should().Be("CHF");
    }

    [Fact]
    public async Task Should_Parse_Entry_BookingDate()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        result.Entries[0].BookingDate.Should().Be(new DateTime(2026, 1, 10));
        result.Entries[1].BookingDate.Should().Be(new DateTime(2026, 1, 12));
        result.Entries[2].BookingDate.Should().Be(new DateTime(2026, 1, 14));
    }

    [Fact]
    public async Task Should_Parse_Entry_EndToEndId()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        result.Entries[0].EndToEndId.Should().Be("INV-2026-001");
    }

    [Fact]
    public async Task Should_Parse_Entry_CreditorReference()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        // Second entry has NOTREF as EndToEndId (not filtered because it's not NOTPROVIDED)
        // and a creditor reference
        result.Entries[1].CreditorReference.Should().Be("INV-2026-002");
    }

    [Fact]
    public async Task Should_Parse_Entry_RemittanceInfo()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        // First entry has Ustrd remittance info
        result.Entries[0].RemittanceInfo.Should().Be("Invoice INV-2026-001 payment");
    }

    [Fact]
    public async Task Should_Parse_Entry_DebtorName_And_Iban()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        var first = result.Entries[0];
        first.DebtorName.Should().Be("Test AG");
        first.DebtorIban.Should().Be("CH1234567890123456789");

        // Second entry: debtor name but no IBAN
        var second = result.Entries[1];
        second.DebtorName.Should().Be("Max Mustermann");
        second.DebtorIban.Should().BeNull();
    }

    [Fact]
    public async Task Should_Parse_CreditDebitIndicator()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        result.Entries[0].CreditDebitIndicator.Should().Be("CRDT");
        result.Entries[1].CreditDebitIndicator.Should().Be("CRDT");
        result.Entries[2].CreditDebitIndicator.Should().Be("DBIT");
    }

    [Fact]
    public async Task Should_Parse_Entry_Without_TxDtls()
    {
        await using var stream = OpenFixture("sample_camt053.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        // Third entry has no TxDtls
        var third = result.Entries[2];
        third.Amount.Should().Be(75.50m);
        third.EndToEndId.Should().BeNull();
        third.CreditorReference.Should().BeNull();
        third.DebtorName.Should().BeNull();
        // RemittanceInfo falls back to AddtlNtryInf when TxDtls is absent
        third.RemittanceInfo.Should().Be("Bank fee January");
    }

    #endregion

    #region CamtParser_054

    [Fact]
    public async Task Should_Parse_Camt054_Successfully()
    {
        await using var stream = OpenFixture("sample_camt054.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        result.MessageId.Should().Be("MSG-2026-054");
        result.StatementId.Should().Be("NTFCTN-2026-001");
        result.AccountIban.Should().Be("CH9300762011623852957");
    }

    [Fact]
    public async Task Should_Parse_Notification_Entries()
    {
        await using var stream = OpenFixture("sample_camt054.xml");

        var result = await _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        result.Entries.Should().HaveCount(2);

        var first = result.Entries[0];
        first.Amount.Should().Be(200.00m);
        first.EndToEndId.Should().Be("INV-2026-010");
        first.DebtorName.Should().Be("Anna Beispiel");
        first.DebtorIban.Should().Be("CH9876543210987654321");

        // Second entry: NOTPROVIDED should be filtered to null
        var second = result.Entries[1];
        second.Amount.Should().Be(350.00m);
        second.EndToEndId.Should().BeNull();
        second.CreditorReference.Should().Be("INV-2026-011");
        second.DebtorName.Should().Be("Sponsor GmbH");
    }

    #endregion

    #region CamtParser_Errors

    [Fact]
    public async Task Should_Throw_For_Invalid_Xml()
    {
        using var stream = new MemoryStream("not valid xml"u8.ToArray());

        var act = () => _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task Should_Throw_When_No_Statement_Or_Notification()
    {
        const string xml = """
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
              <BkToCstmrStmt>
                <GrpHdr>
                  <MsgId>MSG-EMPTY</MsgId>
                  <CreDtTm>2026-01-01T00:00:00</CreDtTm>
                </GrpHdr>
              </BkToCstmrStmt>
            </Document>
            """;
        using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(xml));

        var act = () => _sut.ParseAsync(stream, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Statement*Notification*");
    }

    #endregion
}

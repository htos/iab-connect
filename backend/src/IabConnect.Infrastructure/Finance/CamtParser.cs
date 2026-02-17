using System.Globalization;
using System.Xml.Linq;
using IabConnect.Application.Finance.BankImports;

namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-069: Parses ISO 20022 camt.053 (BkToCstmrStmt) and camt.054 (BkToCstmrDbtCdtNtfctn) XML files.
/// Supports multiple namespace versions (.001.02 through .001.08).
/// </summary>
public sealed class CamtParser : ICamtParser
{
    public Task<CamtParseResult> ParseAsync(Stream xmlStream, CancellationToken ct = default)
    {
        var doc = XDocument.Load(xmlStream);
        var root = doc.Root
            ?? throw new InvalidOperationException("XML document has no root element.");

        var ns = root.Name.Namespace;

        // Find the statement (camt.053) or notification (camt.054) element
        var stmtOrNtfctn = root.Descendants(ns + "Stmt").FirstOrDefault()
            ?? root.Descendants(ns + "Ntfctn").FirstOrDefault();

        if (stmtOrNtfctn is null)
            throw new InvalidOperationException(
                "No Statement (Stmt) or Notification (Ntfctn) found in camt file.");

        var messageId = root.Descendants(ns + "MsgId").FirstOrDefault()?.Value ?? "";
        var stmtId = stmtOrNtfctn.Element(ns + "Id")?.Value;
        var creationDateStr = root.Descendants(ns + "CreDtTm").FirstOrDefault()?.Value;
        var creationDate = creationDateStr is not null
            ? DateTime.Parse(creationDateStr, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal)
            : (DateTime?)null;
        var accountIban = stmtOrNtfctn.Descendants(ns + "IBAN").FirstOrDefault()?.Value;

        var entries = new List<CamtEntry>();

        foreach (var ntry in stmtOrNtfctn.Elements(ns + "Ntry"))
        {
            var amtElement = ntry.Element(ns + "Amt");
            var amount = decimal.Parse(
                amtElement?.Value ?? "0",
                CultureInfo.InvariantCulture);
            var ccy = amtElement?.Attribute("Ccy")?.Value;
            var cdtDbtInd = ntry.Element(ns + "CdtDbtInd")?.Value;

            var bookDt = ntry.Descendants(ns + "BookgDt").FirstOrDefault()?.Element(ns + "Dt")?.Value
                ?? ntry.Descendants(ns + "BookgDt").FirstOrDefault()?.Element(ns + "DtTm")?.Value;
            var valDt = ntry.Descendants(ns + "ValDt").FirstOrDefault()?.Element(ns + "Dt")?.Value
                ?? ntry.Descendants(ns + "ValDt").FirstOrDefault()?.Element(ns + "DtTm")?.Value;

            var addtlEntryInf = ntry.Element(ns + "AddtlNtryInf")?.Value;

            // Bank transaction code (domain/family/sub-family)
            var bankTxCd = ntry.Descendants(ns + "BkTxCd").FirstOrDefault()
                ?.Descendants(ns + "Cd").FirstOrDefault()?.Value;

            // Parse transaction details (may be nested in NtryDtls > TxDtls)
            var txDtls = ntry.Descendants(ns + "TxDtls").FirstOrDefault();
            string? endToEndId = null, creditorRef = null, remittanceInfo = null;
            string? debtorName = null, debtorIban = null, creditorName = null, creditorIban = null;

            if (txDtls is not null)
            {
                // References
                var refs = txDtls.Element(ns + "Refs");
                endToEndId = refs?.Element(ns + "EndToEndId")?.Value;

                // Filter out NOTPROVIDED placeholder
                if (string.Equals(endToEndId, "NOTPROVIDED", StringComparison.OrdinalIgnoreCase))
                    endToEndId = null;

                // Remittance info
                var rmtInf = txDtls.Element(ns + "RmtInf");
                remittanceInfo = rmtInf?.Element(ns + "Ustrd")?.Value;
                creditorRef = rmtInf?.Descendants(ns + "CdtrRef").FirstOrDefault()
                    ?.Descendants(ns + "Ref").FirstOrDefault()?.Value;

                // Related parties
                var rltdPties = txDtls.Element(ns + "RltdPties");
                if (rltdPties is not null)
                {
                    debtorName = rltdPties.Element(ns + "Dbtr")?.Element(ns + "Nm")?.Value;
                    debtorIban = rltdPties.Element(ns + "DbtrAcct")
                        ?.Descendants(ns + "IBAN").FirstOrDefault()?.Value;

                    creditorName = rltdPties.Element(ns + "Cdtr")?.Element(ns + "Nm")?.Value;
                    creditorIban = rltdPties.Element(ns + "CdtrAcct")
                        ?.Descendants(ns + "IBAN").FirstOrDefault()?.Value;
                }
            }

            if (bookDt is not null)
            {
                var bookingDate = DateTime.Parse(bookDt, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal);
                var valueDate = valDt is not null
                    ? DateTime.Parse(valDt, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal)
                    : (DateTime?)null;

                entries.Add(new CamtEntry(
                    bookingDate,
                    valueDate,
                    amount,
                    ccy ?? "CHF",
                    cdtDbtInd,
                    endToEndId,
                    creditorRef,
                    remittanceInfo ?? addtlEntryInf,
                    debtorName, debtorIban,
                    creditorName, creditorIban,
                    bankTxCd,
                    addtlEntryInf));
            }
        }

        return Task.FromResult(new CamtParseResult(messageId, stmtId, creationDate, accountIban, entries));
    }
}

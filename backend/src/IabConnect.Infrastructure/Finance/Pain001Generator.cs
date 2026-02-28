using System.Globalization;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using IabConnect.Application.Finance.Exports.Pain001;

namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-073: Generates ISO 20022 pain.001.001.09 XML for credit transfer initiation.
/// Supports CH SPS (Swiss Payment Standards) and SEPA profiles.
/// </summary>
public sealed partial class Pain001Generator : IPain001Generator
{
    private static readonly XNamespace Ns = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09";
    private static readonly XNamespace Xsi = "http://www.w3.org/2001/XMLSchema-instance";

    public string Generate(Pain001Config config, IReadOnlyList<Pain001PaymentInfo> payments)
    {
        var validation = Validate(config, payments);
        if (!validation.IsValid)
        {
            throw new InvalidOperationException(
                $"Cannot generate pain.001: {string.Join("; ", validation.Errors)}");
        }

        var totalAmount = payments.Sum(p => p.Amount);
        var now = DateTimeOffset.UtcNow;

        var document = new XDocument(
            new XDeclaration("1.0", "UTF-8", null),
            new XElement(Ns + "Document",
                new XAttribute(XNamespace.Xmlns + "xsi", Xsi),
                BuildCstmrCdtTrfInitn(config, payments, totalAmount, now)));

        return document.Declaration + Environment.NewLine + document.ToString();
    }

    public Pain001ValidationResult Validate(Pain001Config config, IReadOnlyList<Pain001PaymentInfo> payments)
    {
        var result = new Pain001ValidationResult();

        // At least one payment
        if (payments.Count == 0)
        {
            result.Errors.Add("At least one payment is required.");
        }

        // Debtor IBAN
        if (string.IsNullOrWhiteSpace(config.DebtorIban))
        {
            result.Errors.Add("Debtor IBAN is required.");
        }
        else if (!IsValidIbanFormat(config.DebtorIban))
        {
            result.Errors.Add($"Debtor IBAN '{config.DebtorIban}' has invalid format.");
        }
        else
        {
            ValidateIbanProfileMatch(config.DebtorIban, config.Profile, "Debtor", result);
        }

        // Debtor name
        if (string.IsNullOrWhiteSpace(config.DebtorName))
        {
            result.Errors.Add("Debtor name is required.");
        }

        // MessageId max 35 chars
        if (!string.IsNullOrEmpty(config.MessageId) && config.MessageId.Length > 35)
        {
            result.Errors.Add($"MessageId exceeds 35 characters ({config.MessageId.Length}).");
        }

        // BIC validation
        if (!string.IsNullOrWhiteSpace(config.DebtorBic) && !IsValidBicFormat(config.DebtorBic))
        {
            result.Errors.Add($"Debtor BIC '{config.DebtorBic}' has invalid format (must be 8 or 11 characters).");
        }

        // Validate each payment
        for (var i = 0; i < payments.Count; i++)
        {
            var p = payments[i];
            var prefix = $"Payment[{i}]";

            if (p.Amount <= 0)
            {
                result.Errors.Add($"{prefix}: Amount must be greater than zero.");
            }

            if (string.IsNullOrWhiteSpace(p.CreditorName))
            {
                result.Errors.Add($"{prefix}: Creditor name is required.");
            }

            if (string.IsNullOrWhiteSpace(p.CreditorIban))
            {
                result.Errors.Add($"{prefix}: Creditor IBAN is required.");
            }
            else if (!IsValidIbanFormat(p.CreditorIban))
            {
                result.Errors.Add($"{prefix}: Creditor IBAN '{p.CreditorIban}' has invalid format.");
            }

            if (!string.IsNullOrWhiteSpace(p.CreditorBic) && !IsValidBicFormat(p.CreditorBic))
            {
                result.Errors.Add($"{prefix}: Creditor BIC '{p.CreditorBic}' has invalid format.");
            }

            // EndToEndId max 35 chars
            if (!string.IsNullOrWhiteSpace(p.EndToEndId) && p.EndToEndId.Length > 35)
            {
                result.Errors.Add($"{prefix}: EndToEndId exceeds 35 characters ({p.EndToEndId.Length}).");
            }

            // Currency match warnings
            if (!string.IsNullOrWhiteSpace(p.Currency) && p.Currency != config.Currency)
            {
                result.Warnings.Add($"{prefix}: Currency '{p.Currency}' differs from profile currency '{config.Currency}'.");
            }
        }

        return result;
    }

    #region XML Building

    private static XElement BuildCstmrCdtTrfInitn(
        Pain001Config config,
        IReadOnlyList<Pain001PaymentInfo> payments,
        decimal totalAmount,
        DateTimeOffset creationDateTime)
    {
        return new XElement(Ns + "CstmrCdtTrfInitn",
            BuildGrpHdr(config, payments.Count, totalAmount, creationDateTime),
            BuildPmtInf(config, payments, totalAmount));
    }

    private static XElement BuildGrpHdr(
        Pain001Config config,
        int nbOfTxs,
        decimal ctrlSum,
        DateTimeOffset creationDateTime)
    {
        return new XElement(Ns + "GrpHdr",
            new XElement(Ns + "MsgId", Truncate(config.MessageId, 35)),
            new XElement(Ns + "CreDtTm", creationDateTime.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture)),
            new XElement(Ns + "NbOfTxs", nbOfTxs.ToString(CultureInfo.InvariantCulture)),
            new XElement(Ns + "CtrlSum", FormatAmount(ctrlSum)),
            new XElement(Ns + "InitgPty",
                new XElement(Ns + "Nm", Truncate(config.InitiatingPartyName, 70))));
    }

    private static XElement BuildPmtInf(
        Pain001Config config,
        IReadOnlyList<Pain001PaymentInfo> payments,
        decimal totalAmount)
    {
        var pmtInf = new XElement(Ns + "PmtInf",
            new XElement(Ns + "PmtInfId", Truncate($"PMT-{config.MessageId}", 35)),
            new XElement(Ns + "PmtMtd", "TRF"),
            new XElement(Ns + "BtchBookg", "true"),
            new XElement(Ns + "NbOfTxs", payments.Count.ToString(CultureInfo.InvariantCulture)),
            new XElement(Ns + "CtrlSum", FormatAmount(totalAmount)));

        // Service level
        pmtInf.Add(BuildPmtTpInf(config.Profile));

        // Requested execution date (use date from first payment or today)
        var execDate = payments.Count > 0
            ? payments[0].RequestedExecutionDate
            : DateTimeOffset.UtcNow;

        pmtInf.Add(new XElement(Ns + "ReqdExctnDt",
            new XElement(Ns + "Dt", execDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))));

        // Debtor
        pmtInf.Add(BuildDebtor(config));

        // Debtor account
        pmtInf.Add(new XElement(Ns + "DbtrAcct",
            new XElement(Ns + "Id",
                new XElement(Ns + "IBAN", NormalizeIban(config.DebtorIban)))));

        // Debtor agent
        pmtInf.Add(BuildDbtrAgt(config));

        // Credit transfers
        foreach (var payment in payments)
        {
            pmtInf.Add(BuildCdtTrfTxInf(payment, config.Profile));
        }

        return pmtInf;
    }

    private static XElement BuildPmtTpInf(Pain001Profile profile)
    {
        var svcLvlCode = profile == Pain001Profile.Sepa ? "SEPA" : "SDVA";

        return new XElement(Ns + "PmtTpInf",
            new XElement(Ns + "SvcLvl",
                new XElement(Ns + "Cd", svcLvlCode)));
    }

    private static XElement BuildDebtor(Pain001Config config)
    {
        var dbtr = new XElement(Ns + "Dbtr",
            new XElement(Ns + "Nm", Truncate(config.DebtorName, 70)));

        var postalAddr = BuildPostalAddress(
            config.DebtorStreet, config.DebtorPostalCode, config.DebtorCity, config.DebtorCountry);
        if (postalAddr is not null)
        {
            dbtr.Add(postalAddr);
        }

        return dbtr;
    }

    private static XElement BuildDbtrAgt(Pain001Config config)
    {
        var finInstnId = new XElement(Ns + "FinInstnId");

        if (!string.IsNullOrWhiteSpace(config.DebtorBic))
        {
            finInstnId.Add(new XElement(Ns + "BICFI", config.DebtorBic.Trim().ToUpperInvariant()));
        }
        else
        {
            // If no BIC, some banks accept the element with just the identification
            finInstnId.Add(new XElement(Ns + "Othr",
                new XElement(Ns + "Id", "NOTPROVIDED")));
        }

        return new XElement(Ns + "DbtrAgt", finInstnId);
    }

    private static XElement BuildCdtTrfTxInf(Pain001PaymentInfo payment, Pain001Profile profile)
    {
        var txInf = new XElement(Ns + "CdtTrfTxInf");

        // Payment identification
        var instrId = $"INS-{payment.PaymentId.ToString("N")[..16].ToUpperInvariant()}";
        txInf.Add(new XElement(Ns + "PmtId",
            new XElement(Ns + "InstrId", Truncate(instrId, 35)),
            new XElement(Ns + "EndToEndId", Truncate(payment.EndToEndId, 35))));

        // Amount
        txInf.Add(new XElement(Ns + "Amt",
            new XElement(Ns + "InstdAmt",
                new XAttribute("Ccy", payment.Currency),
                FormatAmount(payment.Amount))));

        // Creditor agent (BIC)
        if (!string.IsNullOrWhiteSpace(payment.CreditorBic))
        {
            txInf.Add(new XElement(Ns + "CdtrAgt",
                new XElement(Ns + "FinInstnId",
                    new XElement(Ns + "BICFI", payment.CreditorBic.Trim().ToUpperInvariant()))));
        }

        // Creditor
        var cdtr = new XElement(Ns + "Cdtr",
            new XElement(Ns + "Nm", Truncate(payment.CreditorName, 70)));

        var postalAddr = BuildPostalAddress(
            payment.CreditorStreet, payment.CreditorPostalCode, payment.CreditorCity, payment.CreditorCountry);
        if (postalAddr is not null)
        {
            cdtr.Add(postalAddr);
        }

        txInf.Add(cdtr);

        // Creditor account
        txInf.Add(new XElement(Ns + "CdtrAcct",
            new XElement(Ns + "Id",
                new XElement(Ns + "IBAN", NormalizeIban(payment.CreditorIban)))));

        // Remittance information
        var rmtInf = BuildRmtInf(payment, profile);
        if (rmtInf is not null)
        {
            txInf.Add(rmtInf);
        }

        return txInf;
    }

    private static XElement? BuildPostalAddress(
        string? street, string? postalCode, string? city, string? country)
    {
        if (string.IsNullOrWhiteSpace(street) &&
            string.IsNullOrWhiteSpace(city) &&
            string.IsNullOrWhiteSpace(postalCode) &&
            string.IsNullOrWhiteSpace(country))
        {
            return null;
        }

        var addr = new XElement(Ns + "PstlAdr");

        if (!string.IsNullOrWhiteSpace(country))
        {
            addr.Add(new XElement(Ns + "Ctry", country.Trim().ToUpperInvariant()));
        }

        if (!string.IsNullOrWhiteSpace(street))
        {
            addr.Add(new XElement(Ns + "AdrLine", Truncate(street, 70)));
        }

        if (!string.IsNullOrWhiteSpace(postalCode) || !string.IsNullOrWhiteSpace(city))
        {
            var cityLine = string.Join(" ",
                new[] { postalCode?.Trim(), city?.Trim() }.Where(s => !string.IsNullOrWhiteSpace(s)));
            if (!string.IsNullOrEmpty(cityLine))
            {
                addr.Add(new XElement(Ns + "AdrLine", Truncate(cityLine, 70)));
            }
        }

        return addr;
    }

    private static XElement? BuildRmtInf(Pain001PaymentInfo payment, Pain001Profile profile)
    {
        // Structured reference: QR-ref for CH SPS, creditor reference (ISO 11649) for SEPA
        var structuredRef = profile == Pain001Profile.ChSps
            ? payment.QrReference
            : payment.CreditorReference;

        if (!string.IsNullOrWhiteSpace(structuredRef))
        {
            return new XElement(Ns + "RmtInf",
                new XElement(Ns + "Strd",
                    new XElement(Ns + "CdtrRefInf",
                        new XElement(Ns + "Ref", structuredRef.Trim()))));
        }

        // Unstructured remittance info
        if (!string.IsNullOrWhiteSpace(payment.RemittanceInfo))
        {
            return new XElement(Ns + "RmtInf",
                new XElement(Ns + "Ustrd", Truncate(payment.RemittanceInfo, 140)));
        }

        return null;
    }

    #endregion

    #region Helpers

    private static string FormatAmount(decimal amount) =>
        amount.ToString("F2", CultureInfo.InvariantCulture);

    private static string Truncate(string value, int maxLength) =>
        string.IsNullOrEmpty(value) ? value : (value.Length <= maxLength ? value : value[..maxLength]);

    private static string NormalizeIban(string iban) =>
        iban.Replace(" ", "").ToUpperInvariant();

    public static bool IsValidIbanFormat(string iban)
    {
        if (string.IsNullOrWhiteSpace(iban)) return false;
        var normalized = NormalizeIban(iban);
        return IbanRegex().IsMatch(normalized);
    }

    public static bool IsValidBicFormat(string bic)
    {
        if (string.IsNullOrWhiteSpace(bic)) return false;
        var trimmed = bic.Trim().ToUpperInvariant();
        return trimmed.Length is 8 or 11 && BicRegex().IsMatch(trimmed);
    }

    private static void ValidateIbanProfileMatch(
        string iban, Pain001Profile profile, string party, Pain001ValidationResult result)
    {
        var normalized = NormalizeIban(iban);
        var countryCode = normalized[..2];

        if (profile == Pain001Profile.ChSps)
        {
            if (countryCode is not ("CH" or "LI"))
            {
                result.Warnings.Add($"{party} IBAN country '{countryCode}' is not CH/LI for CH SPS profile.");
            }
        }
    }

    // IBAN: 2 uppercase letters + 2 digits + 10..30 alphanumeric
    [GeneratedRegex(@"^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$")]
    private static partial Regex IbanRegex();

    // BIC: 4 letters (bank) + 2 letters (country) + 2 alphanum (location) + optional 3 alphanum (branch)
    [GeneratedRegex(@"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$")]
    private static partial Regex BicRegex();

    #endregion
}

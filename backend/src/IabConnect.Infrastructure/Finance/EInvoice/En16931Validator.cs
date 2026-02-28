using System.Globalization;
using System.Xml.Linq;
using IabConnect.Application.Finance.EInvoice;

namespace IabConnect.Infrastructure.Finance.EInvoice;

/// <summary>
/// REQ-072: EN 16931 baseline eInvoice validator.
/// Performs offline validation of UBL 2.1 Invoice XML against mandatory business rules.
/// Delegates to registered ICiusProfile implementations for country-specific rules.
/// </summary>
public sealed class En16931Validator : IEInvoiceValidator
{
    private static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
    private static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private static readonly XNamespace Inv = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";

    private readonly IEnumerable<ICiusProfile> _ciusProfiles;

    public En16931Validator(IEnumerable<ICiusProfile> ciusProfiles)
    {
        _ciusProfiles = ciusProfiles;
    }

    public Task<EInvoiceValidationResult> ValidateAsync(string ublXml, CancellationToken ct = default)
    {
        var errors = new List<EInvoiceValidationError>();
        var warnings = new List<EInvoiceValidationWarning>();

        // Parse XML
        XDocument doc;
        try
        {
            doc = XDocument.Parse(ublXml);
        }
        catch (Exception ex)
        {
            errors.Add(new EInvoiceValidationError
            {
                RuleId = "XML-PARSE",
                Field = "Document",
                Message = $"Invalid XML: {ex.Message}",
                Severity = "Fatal"
            });
            return Task.FromResult(new EInvoiceValidationResult { Errors = errors, Warnings = warnings });
        }

        var root = doc.Root;
        if (root is null || root.Name != Inv + "Invoice")
        {
            errors.Add(new EInvoiceValidationError
            {
                RuleId = "XML-ROOT",
                Field = "Document",
                Message = "Root element must be {urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice.",
                Severity = "Fatal"
            });
            return Task.FromResult(new EInvoiceValidationResult { Errors = errors, Warnings = warnings });
        }

        // EN 16931 mandatory field rules
        ValidateMandatoryFields(root, errors);

        // Invoice line rules
        ValidateInvoiceLines(root, errors);

        // Tax breakdown rules
        ValidateTaxBreakdown(root, errors);

        // Calculation consistency rules
        ValidateCalculations(root, errors);

        // VAT category-specific rules
        ValidateVatCategories(root, errors);

        // Warnings for recommended fields
        ValidateRecommendedFields(root, warnings);

        // CIUS profile validation (extension point)
        foreach (var profile in _ciusProfiles)
        {
            var profileResult = profile.Validate(doc);
            errors.AddRange(profileResult.Errors);
            warnings.AddRange(profileResult.Warnings);
        }

        return Task.FromResult(new EInvoiceValidationResult { Errors = errors, Warnings = warnings });
    }

    /// <summary>
    /// BR-01 through BR-11: Mandatory top-level fields.
    /// </summary>
    private void ValidateMandatoryFields(XElement root, List<EInvoiceValidationError> errors)
    {
        // BR-01: Specification identifier (BT-24)
        ValidateRequiredElement(root, Cbc + "CustomizationID", "BR-01", "BT-24",
            "An Invoice shall have a Specification identifier (CustomizationID).", errors);

        // BR-02: Invoice number (BT-1)
        ValidateRequiredElement(root, Cbc + "ID", "BR-02", "BT-1",
            "An Invoice shall have an Invoice number (ID).", errors);

        // BR-03: Invoice issue date (BT-2)
        ValidateRequiredElement(root, Cbc + "IssueDate", "BR-03", "BT-2",
            "An Invoice shall have an Invoice issue date (IssueDate).", errors);

        // BR-04: Invoice type code (BT-3)
        ValidateRequiredElement(root, Cbc + "InvoiceTypeCode", "BR-04", "BT-3",
            "An Invoice shall have an Invoice type code (InvoiceTypeCode).", errors);

        // BR-05: Invoice currency code (BT-5)
        ValidateRequiredElement(root, Cbc + "DocumentCurrencyCode", "BR-05", "BT-5",
            "An Invoice shall have an Invoice currency code (DocumentCurrencyCode).", errors);

        // BR-06: Seller name (BT-27)
        var sellerParty = root.Element(Cac + "AccountingSupplierParty")?.Element(Cac + "Party");
        if (sellerParty is null)
        {
            errors.Add(new EInvoiceValidationError
            {
                RuleId = "BR-06",
                Field = "BT-27",
                Message = "An Invoice shall contain the Seller (AccountingSupplierParty/Party)."
            });
        }
        else
        {
            var sellerName = sellerParty.Element(Cac + "PartyName")?.Element(Cbc + "Name");
            if (sellerName is null || string.IsNullOrWhiteSpace(sellerName.Value))
            {
                errors.Add(new EInvoiceValidationError
                {
                    RuleId = "BR-06",
                    Field = "BT-27",
                    Message = "An Invoice shall contain the Seller name (AccountingSupplierParty/Party/PartyName/Name)."
                });
            }

            // BR-08: Seller postal address (BG-5)
            var sellerAddress = sellerParty.Element(Cac + "PostalAddress");
            if (sellerAddress is null)
            {
                errors.Add(new EInvoiceValidationError
                {
                    RuleId = "BR-08",
                    Field = "BG-5",
                    Message = "An Invoice shall have the Seller postal address (PostalAddress)."
                });
            }
            else
            {
                // BR-09: Seller country (BT-40)
                var sellerCountry = sellerAddress.Element(Cac + "Country")?.Element(Cbc + "IdentificationCode");
                if (sellerCountry is null || string.IsNullOrWhiteSpace(sellerCountry.Value))
                {
                    errors.Add(new EInvoiceValidationError
                    {
                        RuleId = "BR-09",
                        Field = "BT-40",
                        Message = "An Invoice shall have the Seller country code (PostalAddress/Country/IdentificationCode)."
                    });
                }
            }
        }

        // BR-07: Buyer name (BT-44)
        var buyerParty = root.Element(Cac + "AccountingCustomerParty")?.Element(Cac + "Party");
        if (buyerParty is null)
        {
            errors.Add(new EInvoiceValidationError
            {
                RuleId = "BR-07",
                Field = "BT-44",
                Message = "An Invoice shall contain the Buyer (AccountingCustomerParty/Party)."
            });
        }
        else
        {
            var buyerName = buyerParty.Element(Cac + "PartyName")?.Element(Cbc + "Name");
            if (buyerName is null || string.IsNullOrWhiteSpace(buyerName.Value))
            {
                errors.Add(new EInvoiceValidationError
                {
                    RuleId = "BR-07",
                    Field = "BT-44",
                    Message = "An Invoice shall contain the Buyer name (AccountingCustomerParty/Party/PartyName/Name)."
                });
            }

            // BR-10: Buyer postal address (BG-8)
            var buyerAddress = buyerParty.Element(Cac + "PostalAddress");
            if (buyerAddress is null)
            {
                errors.Add(new EInvoiceValidationError
                {
                    RuleId = "BR-10",
                    Field = "BG-8",
                    Message = "An Invoice shall have the Buyer postal address (PostalAddress)."
                });
            }
            else
            {
                // BR-11: Buyer country (BT-55)
                var buyerCountry = buyerAddress.Element(Cac + "Country")?.Element(Cbc + "IdentificationCode");
                if (buyerCountry is null || string.IsNullOrWhiteSpace(buyerCountry.Value))
                {
                    errors.Add(new EInvoiceValidationError
                    {
                        RuleId = "BR-11",
                        Field = "BT-55",
                        Message = "An Invoice shall have the Buyer country code (PostalAddress/Country/IdentificationCode)."
                    });
                }
            }
        }
    }

    /// <summary>
    /// BR-12/13: Invoice lines, BR-14: line identifier.
    /// </summary>
    private void ValidateInvoiceLines(XElement root, List<EInvoiceValidationError> errors)
    {
        var lines = root.Elements(Cac + "InvoiceLine").ToList();

        // BR-12/BR-13: At least one invoice line
        if (lines.Count == 0)
        {
            errors.Add(new EInvoiceValidationError
            {
                RuleId = "BR-13",
                Field = "BG-25",
                Message = "An Invoice shall have at least one Invoice line (InvoiceLine)."
            });
            return;
        }

        foreach (var line in lines)
        {
            // BR-14: Line identifier
            var lineId = line.Element(Cbc + "ID");
            if (lineId is null || string.IsNullOrWhiteSpace(lineId.Value))
            {
                errors.Add(new EInvoiceValidationError
                {
                    RuleId = "BR-14",
                    Field = "BT-126",
                    Message = "Each Invoice line shall have an Invoice line identifier (ID)."
                });
            }
        }
    }

    /// <summary>
    /// BR-16: Tax breakdown (at least one TaxSubtotal in TaxTotal).
    /// </summary>
    private void ValidateTaxBreakdown(XElement root, List<EInvoiceValidationError> errors)
    {
        var taxTotal = root.Element(Cac + "TaxTotal");
        if (taxTotal is null)
        {
            errors.Add(new EInvoiceValidationError
            {
                RuleId = "BR-16",
                Field = "BG-23",
                Message = "An Invoice shall have a Tax total (TaxTotal)."
            });
            return;
        }

        var subtotals = taxTotal.Elements(Cac + "TaxSubtotal").ToList();
        if (subtotals.Count == 0)
        {
            errors.Add(new EInvoiceValidationError
            {
                RuleId = "BR-16",
                Field = "BG-23",
                Message = "An Invoice shall have at least one VAT breakdown (TaxTotal/TaxSubtotal)."
            });
        }
    }

    /// <summary>
    /// BR-CO-10: Sum of line extension amounts = LineExtensionAmount in LegalMonetaryTotal.
    /// BR-CO-15: TaxInclusiveAmount = TaxExclusiveAmount + TaxTotal/TaxAmount.
    /// </summary>
    private void ValidateCalculations(XElement root, List<EInvoiceValidationError> errors)
    {
        var lmt = root.Element(Cac + "LegalMonetaryTotal");
        if (lmt is null) return; // Other rules will catch missing LMT

        // BR-CO-10: Sum of line net amounts
        var lines = root.Elements(Cac + "InvoiceLine").ToList();
        if (lines.Count > 0)
        {
            var sumOfLineAmounts = 0m;
            foreach (var line in lines)
            {
                var lineExtAmt = line.Element(Cbc + "LineExtensionAmount");
                if (lineExtAmt is not null && TryParseDecimal(lineExtAmt.Value, out var amt))
                {
                    sumOfLineAmounts += amt;
                }
            }

            var lineExtTotal = lmt.Element(Cbc + "LineExtensionAmount");
            if (lineExtTotal is not null && TryParseDecimal(lineExtTotal.Value, out var declared))
            {
                if (Math.Abs(sumOfLineAmounts - declared) > 0.01m)
                {
                    errors.Add(new EInvoiceValidationError
                    {
                        RuleId = "BR-CO-10",
                        Field = "BT-106",
                        Message = $"Sum of Invoice line net amounts ({sumOfLineAmounts:F2}) does not equal LineExtensionAmount ({declared:F2})."
                    });
                }
            }
        }

        // BR-CO-15: TaxInclusiveAmount = TaxExclusiveAmount + TaxAmount
        var taxExclEl = lmt.Element(Cbc + "TaxExclusiveAmount");
        var taxInclEl = lmt.Element(Cbc + "TaxInclusiveAmount");
        var taxTotalEl = root.Element(Cac + "TaxTotal")?.Element(Cbc + "TaxAmount");

        if (taxExclEl is not null && taxInclEl is not null && taxTotalEl is not null)
        {
            if (TryParseDecimal(taxExclEl.Value, out var taxExcl)
                && TryParseDecimal(taxInclEl.Value, out var taxIncl)
                && TryParseDecimal(taxTotalEl.Value, out var taxAmt))
            {
                var expected = taxExcl + taxAmt;
                if (Math.Abs(taxIncl - expected) > 0.01m)
                {
                    errors.Add(new EInvoiceValidationError
                    {
                        RuleId = "BR-CO-15",
                        Field = "BT-112",
                        Message = $"Invoice total with VAT ({taxIncl:F2}) must equal Invoice total without VAT ({taxExcl:F2}) + total VAT ({taxAmt:F2}) = {expected:F2}."
                    });
                }
            }
        }
    }

    /// <summary>
    /// VAT category-specific rules:
    /// BR-S-01: Standard rate (S) taxable amount > 0
    /// BR-Z-01: Zero-rated (Z) must have 0% rate
    /// BR-E-01: Exempt (E) must have 0% rate
    /// BR-AE-01: Reverse charge (AE) must have 0% rate
    /// </summary>
    private void ValidateVatCategories(XElement root, List<EInvoiceValidationError> errors)
    {
        var taxTotal = root.Element(Cac + "TaxTotal");
        if (taxTotal is null) return;

        foreach (var subtotal in taxTotal.Elements(Cac + "TaxSubtotal"))
        {
            var category = subtotal.Element(Cac + "TaxCategory");
            if (category is null) continue;

            var catId = category.Element(Cbc + "ID")?.Value;
            var percentEl = category.Element(Cbc + "Percent");
            var taxableAmtEl = subtotal.Element(Cbc + "TaxableAmount");

            TryParseDecimal(percentEl?.Value, out var percent);
            TryParseDecimal(taxableAmtEl?.Value, out var taxableAmt);

            switch (catId)
            {
                case "S":
                    // BR-S-01: Standard rate — taxable amount must be > 0
                    if (taxableAmt <= 0)
                    {
                        errors.Add(new EInvoiceValidationError
                        {
                            RuleId = "BR-S-01",
                            Field = "BT-116",
                            Message = "In a VAT breakdown where VAT category is Standard (S), the taxable amount must be greater than zero."
                        });
                    }
                    break;

                case "Z":
                    // BR-Z-01: Zero-rated — rate must be 0%
                    if (percent != 0)
                    {
                        errors.Add(new EInvoiceValidationError
                        {
                            RuleId = "BR-Z-01",
                            Field = "BT-119",
                            Message = $"In a VAT breakdown where VAT category is Zero rated (Z), the VAT rate must be 0% (was {percent}%)."
                        });
                    }
                    break;

                case "E":
                    // BR-E-01: Exempt — rate must be 0%
                    if (percent != 0)
                    {
                        errors.Add(new EInvoiceValidationError
                        {
                            RuleId = "BR-E-01",
                            Field = "BT-119",
                            Message = $"In a VAT breakdown where VAT category is Exempt (E), the VAT rate must be 0% (was {percent}%)."
                        });
                    }
                    break;

                case "AE":
                    // BR-AE-01: Reverse charge — rate must be 0%
                    if (percent != 0)
                    {
                        errors.Add(new EInvoiceValidationError
                        {
                            RuleId = "BR-AE-01",
                            Field = "BT-119",
                            Message = $"In a VAT breakdown where VAT category is Reverse charge (AE), the VAT rate must be 0% (was {percent}%)."
                        });
                    }
                    break;
            }
        }
    }

    /// <summary>
    /// Non-blocking warnings for recommended (but not mandatory) fields.
    /// </summary>
    private void ValidateRecommendedFields(XElement root, List<EInvoiceValidationWarning> warnings)
    {
        // Payment terms
        var paymentTerms = root.Element(Cac + "PaymentTerms");
        if (paymentTerms is null)
        {
            warnings.Add(new EInvoiceValidationWarning
            {
                RuleId = "W-BT-20",
                Field = "BT-20",
                Message = "Payment terms (PaymentTerms) are recommended but not present."
            });
        }

        // Payment means
        var paymentMeans = root.Element(Cac + "PaymentMeans");
        if (paymentMeans is null)
        {
            warnings.Add(new EInvoiceValidationWarning
            {
                RuleId = "W-BG-16",
                Field = "BG-16",
                Message = "Payment means (PaymentMeans) are recommended but not present."
            });
        }

        // Due date
        var dueDate = root.Element(Cbc + "DueDate");
        if (dueDate is null)
        {
            warnings.Add(new EInvoiceValidationWarning
            {
                RuleId = "W-BT-9",
                Field = "BT-9",
                Message = "Payment due date (DueDate) is recommended but not present."
            });
        }
    }

    private static void ValidateRequiredElement(
        XElement parent, XName elementName, string ruleId, string field, string message,
        List<EInvoiceValidationError> errors)
    {
        var el = parent.Element(elementName);
        if (el is null || string.IsNullOrWhiteSpace(el.Value))
        {
            errors.Add(new EInvoiceValidationError
            {
                RuleId = ruleId,
                Field = field,
                Message = message
            });
        }
    }

    private static bool TryParseDecimal(string? value, out decimal result)
    {
        result = 0m;
        if (string.IsNullOrWhiteSpace(value)) return false;
        return decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out result);
    }
}

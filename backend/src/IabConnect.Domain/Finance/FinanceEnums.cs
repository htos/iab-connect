namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-038: Account types for categorizing financial accounts
/// </summary>
public enum AccountType
{
    Cash,
    Bank,
    Other
}

/// <summary>
/// REQ-038: Transaction types
/// </summary>
public enum TransactionType
{
    Income,
    Expense
}

/// <summary>
/// REQ-039: Invoice status workflow
/// </summary>
public enum InvoiceStatus
{
    Draft,
    Sent,
    Paid,
    Overdue,
    Cancelled
}

/// <summary>
/// REQ-039: Invoice recipient types
/// </summary>
public enum RecipientType
{
    Member,
    Sponsor,
    Vendor,
    Other
}

/// <summary>
/// REQ-040: Payment methods
/// </summary>
public enum PaymentMethod
{
    Cash,
    Transfer,
    Online
}

/// <summary>
/// REQ-041: Bank import processing status
/// </summary>
public enum BankImportStatus
{
    Pending,
    Processed
}

/// <summary>
/// REQ-041: Individual bank import item matching status
/// </summary>
public enum BankImportItemStatus
{
    Unmatched,
    Matched,
    Ignored
}

/// <summary>
/// REQ-042: Dunning notice status
/// </summary>
public enum DunningStatus
{
    Created,
    Sent
}

/// <summary>
/// REQ-060: Jurisdiction (country/region baseline for finance setup)
/// </summary>
public enum Jurisdiction
{
    CH,
    EU
}

/// <summary>
/// REQ-060: Supported currencies for finance profiles
/// </summary>
public enum FinanceCurrency
{
    CHF,
    EUR
}

/// <summary>
/// REQ-062: VAT registration status of the organization
/// </summary>
public enum VatStatus
{
    NotRegistered,
    Registered,
    SmallBusiness
}

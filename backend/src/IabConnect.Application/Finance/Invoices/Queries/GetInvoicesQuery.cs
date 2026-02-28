using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

/// <summary>
/// Shared DTOs for invoice data
/// </summary>
public sealed record InvoiceListDto(
    Guid Id, string InvoiceNumber, DateTime Date, DateTime DueDate,
    string Status, string RecipientType, string RecipientName, decimal Total,
    decimal SubtotalNet, decimal TotalTax, decimal TotalGross,
    DateTime CreatedAt, string CreatedBy);

public sealed record InvoiceDetailDto(
    Guid Id, string InvoiceNumber, DateTime Date, DateTime DueDate,
    string Status, string RecipientType, Guid? RecipientId, string RecipientName,
    string? RecipientAddress, decimal SubTotal, decimal TaxRate, decimal TaxAmount, decimal Total,
    decimal SubtotalNet, decimal TotalTax, decimal TotalGross,
    string? Notes, string? PaymentTerms, Guid? TemplateId,
    string? CancellationReason, DateTime? CancelledAt,
    List<InvoiceItemDto> Items,
    DateTime CreatedAt, string CreatedBy, DateTime? UpdatedAt, string? UpdatedBy);

public sealed record InvoiceItemDto(
    Guid Id, string Description, decimal Quantity, decimal UnitPrice, decimal Amount,
    Guid? TaxCodeId, decimal? TaxRate, decimal? TaxAmount, decimal? NetAmount,
    decimal? GrossAmount, bool IsGrossEntry, Guid? ActivityAreaId);

/// <summary>
/// Query to get invoices with optional status filter (REQ-039) with pagination support
/// </summary>
public sealed record GetInvoicesQuery(string? Status) : IRequest<PagedResult<InvoiceListDto>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Filter { get; init; }
}

using IabConnect.Domain.Sponsors;
using MediatR;

namespace IabConnect.Application.Sponsors.Commands;

public sealed record CreateSupplierCommand : IRequest<Guid>
{
    public required string CompanyName { get; init; }
    public string? ContactPerson { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Website { get; init; }
    public string? Street { get; init; }
    public string? City { get; init; }
    public string? PostalCode { get; init; }
    public string? Country { get; init; }
    public string? Category { get; init; }
    public string? Notes { get; init; }
}

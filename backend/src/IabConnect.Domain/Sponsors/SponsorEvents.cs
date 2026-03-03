using IabConnect.Domain.Common;

namespace IabConnect.Domain.Sponsors;

public sealed record SponsorCreatedEvent(Guid SponsorId, string CompanyName) : DomainEvent;
public sealed record SponsorStatusChangedEvent(Guid SponsorId, SponsorStatus NewStatus) : DomainEvent;
public sealed record SupplierCreatedEvent(Guid SupplierId, string CompanyName) : DomainEvent;
public sealed record SupplierStatusChangedEvent(Guid SupplierId, SupplierStatus NewStatus) : DomainEvent;

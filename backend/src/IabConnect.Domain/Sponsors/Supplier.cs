using IabConnect.Domain.Common;

namespace IabConnect.Domain.Sponsors;

public sealed class Supplier : AggregateRoot
{
    public string CompanyName { get; private set; } = null!;
    public string? ContactPerson { get; private set; }
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? Website { get; private set; }
    public string? Street { get; private set; }
    public string? City { get; private set; }
    public string? PostalCode { get; private set; }
    public string? Country { get; private set; }
    public SupplierStatus Status { get; private set; }
    public string? Category { get; private set; }
    public string? Notes { get; private set; }

    private readonly List<ContractLink> _contractLinks = [];
    public IReadOnlyList<ContractLink> ContractLinks => _contractLinks.AsReadOnly();

    private Supplier() : base() { }

    public static Supplier Create(
        string companyName,
        string? contactPerson,
        string? email,
        string? phone,
        string? website,
        string? street,
        string? city,
        string? postalCode,
        string? country,
        string? category,
        string? notes,
        Guid? createdBy = null)
    {
        var supplier = new Supplier
        {
            CompanyName = companyName,
            ContactPerson = contactPerson,
            Email = email,
            Phone = phone,
            Website = website,
            Street = street,
            City = city,
            PostalCode = postalCode,
            Country = country,
            Status = SupplierStatus.Prospect,
            Category = category,
            Notes = notes
        };
        supplier.SetCreatedBy(createdBy ?? Guid.Empty);
        supplier.AddDomainEvent(new SupplierCreatedEvent(supplier.Id, companyName));
        return supplier;
    }

    public void Update(
        string companyName,
        string? contactPerson,
        string? email,
        string? phone,
        string? website,
        string? street,
        string? city,
        string? postalCode,
        string? country,
        string? category,
        string? notes,
        Guid? updatedBy = null)
    {
        CompanyName = companyName;
        ContactPerson = contactPerson;
        Email = email;
        Phone = phone;
        Website = website;
        Street = street;
        City = city;
        PostalCode = postalCode;
        Country = country;
        Category = category;
        Notes = notes;
        SetUpdated(updatedBy);
    }

    public void Activate(Guid? updatedBy = null)
    {
        Status = SupplierStatus.Active;
        SetUpdated(updatedBy);
        AddDomainEvent(new SupplierStatusChangedEvent(Id, SupplierStatus.Active));
    }

    public void Pause(Guid? updatedBy = null)
    {
        Status = SupplierStatus.Paused;
        SetUpdated(updatedBy);
        AddDomainEvent(new SupplierStatusChangedEvent(Id, SupplierStatus.Paused));
    }

    public void End(Guid? updatedBy = null)
    {
        Status = SupplierStatus.Ended;
        SetUpdated(updatedBy);
        AddDomainEvent(new SupplierStatusChangedEvent(Id, SupplierStatus.Ended));
    }

    public ContractLink AddContractLink(ContractLinkType linkType, Guid targetId, string? description, Guid? createdBy = null)
    {
        var link = ContractLink.Create(null, Id, linkType, targetId, description);
        _contractLinks.Add(link);
        SetUpdated(createdBy);
        return link;
    }

    public void RemoveContractLink(Guid linkId, Guid? updatedBy = null)
    {
        var link = _contractLinks.FirstOrDefault(l => l.Id == linkId);
        if (link is not null)
        {
            _contractLinks.Remove(link);
            SetUpdated(updatedBy);
        }
    }
}

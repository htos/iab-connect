using IabConnect.Domain.Common;

namespace IabConnect.Domain.Sponsors;

public sealed class Sponsor : AggregateRoot
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
    public SponsorStatus Status { get; private set; }
    public SponsorTier Tier { get; private set; }
    public string? Notes { get; private set; }
    public DateOnly? AgreementStart { get; private set; }
    public DateOnly? AgreementEnd { get; private set; }

    private readonly List<SponsorPackage> _packages = [];
    public IReadOnlyList<SponsorPackage> Packages => _packages.AsReadOnly();

    private readonly List<ContractLink> _contractLinks = [];
    public IReadOnlyList<ContractLink> ContractLinks => _contractLinks.AsReadOnly();

    private Sponsor() : base() { }

    public static Sponsor Create(
        string companyName,
        string? contactPerson,
        string? email,
        string? phone,
        string? website,
        string? street,
        string? city,
        string? postalCode,
        string? country,
        SponsorTier tier,
        string? notes,
        DateOnly? agreementStart,
        DateOnly? agreementEnd,
        Guid? createdBy = null)
    {
        var sponsor = new Sponsor
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
            Status = SponsorStatus.Prospect,
            Tier = tier,
            Notes = notes,
            AgreementStart = agreementStart,
            AgreementEnd = agreementEnd
        };
        sponsor.SetCreatedBy(createdBy ?? Guid.Empty);
        sponsor.AddDomainEvent(new SponsorCreatedEvent(sponsor.Id, companyName));
        return sponsor;
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
        SponsorTier tier,
        string? notes,
        DateOnly? agreementStart,
        DateOnly? agreementEnd,
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
        Tier = tier;
        Notes = notes;
        AgreementStart = agreementStart;
        AgreementEnd = agreementEnd;
        SetUpdated(updatedBy);
    }

    public void Activate(Guid? updatedBy = null)
    {
        Status = SponsorStatus.Active;
        SetUpdated(updatedBy);
        AddDomainEvent(new SponsorStatusChangedEvent(Id, SponsorStatus.Active));
    }

    public void Pause(Guid? updatedBy = null)
    {
        Status = SponsorStatus.Paused;
        SetUpdated(updatedBy);
        AddDomainEvent(new SponsorStatusChangedEvent(Id, SponsorStatus.Paused));
    }

    public void End(Guid? updatedBy = null)
    {
        Status = SponsorStatus.Ended;
        SetUpdated(updatedBy);
        AddDomainEvent(new SponsorStatusChangedEvent(Id, SponsorStatus.Ended));
    }

    public SponsorPackage AddPackage(string name, string? description, decimal? amount, string? currency, Guid? createdBy = null)
    {
        var package = SponsorPackage.Create(Id, name, description, amount, currency);
        _packages.Add(package);
        SetUpdated(createdBy);
        return package;
    }

    public void RemovePackage(Guid packageId, Guid? updatedBy = null)
    {
        var package = _packages.FirstOrDefault(p => p.Id == packageId);
        if (package is not null)
        {
            _packages.Remove(package);
            SetUpdated(updatedBy);
        }
    }

    public ContractLink AddContractLink(ContractLinkType linkType, Guid targetId, string? description, Guid? createdBy = null)
    {
        var link = ContractLink.Create(Id, null, linkType, targetId, description);
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

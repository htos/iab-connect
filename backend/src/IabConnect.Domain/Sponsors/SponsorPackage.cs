using IabConnect.Domain.Common;

namespace IabConnect.Domain.Sponsors;

public sealed class SponsorPackage : Entity
{
    public Guid SponsorId { get; private set; }
    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public decimal? Amount { get; private set; }
    public string? Currency { get; private set; }

    private SponsorPackage() : base() { }

    internal static SponsorPackage Create(
        Guid sponsorId,
        string name,
        string? description,
        decimal? amount,
        string? currency)
    {
        return new SponsorPackage
        {
            SponsorId = sponsorId,
            Name = name,
            Description = description,
            Amount = amount,
            Currency = currency
        };
    }

    public void Update(string name, string? description, decimal? amount, string? currency)
    {
        Name = name;
        Description = description;
        Amount = amount;
        Currency = currency;
    }
}

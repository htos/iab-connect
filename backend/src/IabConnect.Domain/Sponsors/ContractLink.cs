using IabConnect.Domain.Common;

namespace IabConnect.Domain.Sponsors;

public sealed class ContractLink : Entity
{
    public Guid? SponsorId { get; private set; }
    public Guid? SupplierId { get; private set; }
    public ContractLinkType LinkType { get; private set; }
    public Guid TargetId { get; private set; }
    public string? Description { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private ContractLink() : base() { }

    internal static ContractLink Create(
        Guid? sponsorId,
        Guid? supplierId,
        ContractLinkType linkType,
        Guid targetId,
        string? description)
    {
        return new ContractLink
        {
            SponsorId = sponsorId,
            SupplierId = supplierId,
            LinkType = linkType,
            TargetId = targetId,
            Description = description,
            CreatedAt = DateTime.UtcNow
        };
    }
}

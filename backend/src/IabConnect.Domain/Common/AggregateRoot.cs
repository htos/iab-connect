namespace IabConnect.Domain.Common;

/// <summary>
/// Base interface for all aggregate roots
/// </summary>
public interface IAggregateRoot
{
    Guid Id { get; }
}

/// <summary>
/// Base class for aggregate roots
/// </summary>
public abstract class AggregateRoot : Entity, IAggregateRoot
{
    public DateTime CreatedAt { get; protected set; }
    public Guid? CreatedBy { get; protected set; }
    public DateTime? UpdatedAt { get; protected set; }
    public Guid? UpdatedBy { get; protected set; }
    public bool IsDeleted { get; protected set; }
    public DateTime? DeletedAt { get; protected set; }
    public Guid? DeletedBy { get; protected set; }

    protected AggregateRoot() : base()
    {
        CreatedAt = DateTime.UtcNow;
    }

    protected AggregateRoot(Guid id) : base(id)
    {
        CreatedAt = DateTime.UtcNow;
    }

    public void SetCreatedBy(Guid userId)
    {
        CreatedBy = userId;
    }

    public void SetUpdated(Guid? userId = null)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = userId;
    }

    public virtual void SoftDelete(Guid? userId = null)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = userId;
    }

    public virtual void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }
}

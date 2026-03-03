using IabConnect.Domain.Common;

namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-049: Contact form message from public website
/// </summary>
public sealed class ContactMessage : AggregateRoot
{
    public string Name { get; private set; } = null!;
    public string Email { get; private set; } = null!;
    public string Subject { get; private set; } = null!;
    public string Message { get; private set; } = null!;
    public ContactMessageStatus Status { get; private set; }
    public string? ResponseNotes { get; private set; }
    public DateTime? RespondedAt { get; private set; }
    public Guid? RespondedBy { get; private set; }

    private ContactMessage() : base() { }

    public static ContactMessage Create(string name, string email, string subject, string message)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required");
        if (string.IsNullOrWhiteSpace(email)) throw new ArgumentException("Email is required");
        if (string.IsNullOrWhiteSpace(subject)) throw new ArgumentException("Subject is required");
        if (string.IsNullOrWhiteSpace(message)) throw new ArgumentException("Message is required");

        var msg = new ContactMessage
        {
            Name = name.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            Subject = subject.Trim(),
            Message = message.Trim(),
            Status = ContactMessageStatus.New
        };
        return msg;
    }

    public void MarkAsRead(Guid userId)
    {
        Status = ContactMessageStatus.Read;
        SetUpdated(userId);
    }

    public void MarkAsResponded(string? notes, Guid userId)
    {
        Status = ContactMessageStatus.Responded;
        ResponseNotes = notes;
        RespondedAt = DateTime.UtcNow;
        RespondedBy = userId;
        SetUpdated(userId);
    }

    public void Archive(Guid userId)
    {
        Status = ContactMessageStatus.Archived;
        SetUpdated(userId);
    }
}

public enum ContactMessageStatus
{
    New,
    Read,
    Responded,
    Archived
}

using IabConnect.Domain.Common;

namespace IabConnect.Domain.Documents;

/// <summary>
/// Tag associated with a document
/// REQ-037: Tags
/// </summary>
public sealed class DocumentTag : Entity
{
    public Guid DocumentId { get; private set; }
    public string Name { get; private set; } = null!;

    private DocumentTag() : base() { }

    public static DocumentTag Create(Guid documentId, string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Tag name is required.", nameof(name));
        if (name.Trim().Length > Document.MaxTagNameLength)
            throw new ArgumentException($"Tag name must not exceed {Document.MaxTagNameLength} characters.", nameof(name));

        return new DocumentTag
        {
            DocumentId = documentId,
            Name = name.Trim().ToLowerInvariant()
        };
    }
}

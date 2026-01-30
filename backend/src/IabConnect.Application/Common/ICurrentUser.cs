namespace IabConnect.Application.Common;

/// <summary>
/// Interface for accessing current user information
/// </summary>
public interface ICurrentUser
{
    Guid? UserId { get; }
    string? Email { get; }
    string? Name { get; }
    IReadOnlyList<string> Roles { get; }
    bool IsAuthenticated { get; }
    bool IsAdmin { get; }
    bool IsVorstand { get; }
    bool IsMember { get; }
}

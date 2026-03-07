namespace IabConnect.Application.Communication;

/// <summary>
/// REQ-029: Service for generating and validating HMAC-based unsubscribe tokens
/// </summary>
public interface IUnsubscribeTokenService
{
    /// <summary>
    /// Generate a secure unsubscribe token for a recipient
    /// </summary>
    string GenerateToken(Guid recipientId);

    /// <summary>
    /// Validate a token and extract the recipient ID
    /// </summary>
    Guid? ValidateToken(string token);
}

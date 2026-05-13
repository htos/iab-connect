using IabConnect.Application.Communication;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Members;
using IabConnect.Domain.Privacy;
using Microsoft.AspNetCore.Mvc;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-029: Public newsletter endpoints (no authentication required).
/// Subscribe/unsubscribe via email or secure HMAC token.
/// </summary>
public static class UnsubscribeEndpoints
{
    public static void MapUnsubscribeEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/public/newsletter")
            .WithTags("Newsletter")
            .AllowAnonymous();

        // Subscribe
        group.MapPost("/subscribe", Subscribe)
            .WithName("NewsletterSubscribe")
            .WithDescription("REQ-029: Public newsletter subscribe");

        // Unsubscribe via email
        group.MapPost("/unsubscribe", UnsubscribeByEmail)
            .WithName("NewsletterUnsubscribeByEmail")
            .WithDescription("REQ-029: Unsubscribe by email address");

        // Token-based unsubscribe (from email links)
        group.MapGet("/unsubscribe/{token}", VerifyUnsubscribe)
            .WithName("VerifyUnsubscribe")
            .WithDescription("REQ-029: Verify unsubscribe token");

        group.MapPost("/unsubscribe/{token}", ConfirmUnsubscribe)
            .WithName("ConfirmUnsubscribe")
            .WithDescription("REQ-029: Confirm token-based unsubscribe");
    }

    /// <summary>
    /// Public newsletter subscribe — anyone with an email can subscribe.
    /// </summary>
    private static async Task<IResult> Subscribe(
        [FromServices] INewsletterSubscriberRepository subscriberRepository,
        [FromBody] NewsletterSubscribeRequest request,
        HttpContext httpContext)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return Results.BadRequest(new { error = "Valid email address required." });

        var email = request.Email.ToLowerInvariant().Trim();
        var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();

        var existing = await subscriberRepository.GetByEmailAsync(email);
        if (existing != null)
        {
            if (existing.IsActive)
                return Results.Ok(new { success = true, message = "Already subscribed." });

            // Resubscribe
            existing.Resubscribe(ipAddress);
            await subscriberRepository.UpdateAsync(existing);
            return Results.Ok(new { success = true, message = "Successfully resubscribed." });
        }

        var subscriber = NewsletterSubscriber.Create(
            email,
            request.FirstName,
            request.LastName,
            ipAddress);

        await subscriberRepository.AddAsync(subscriber);
        return Results.Ok(new { success = true, message = "Successfully subscribed to newsletter." });
    }

    /// <summary>
    /// Unsubscribe by email address — for the public form.
    /// </summary>
    private static async Task<IResult> UnsubscribeByEmail(
        [FromServices] INewsletterSubscriberRepository subscriberRepository,
        [FromServices] IConsentRepository consentRepository,
        [FromServices] IMemberRepository memberRepository,
        [FromBody] NewsletterUnsubscribeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return Results.BadRequest(new { error = "Email address required." });

        var email = request.Email.ToLowerInvariant().Trim();

        // Unsubscribe external subscriber
        var subscriber = await subscriberRepository.GetByEmailAsync(email);
        if (subscriber is { IsActive: true })
        {
            subscriber.Unsubscribe();
            await subscriberRepository.UpdateAsync(subscriber);
        }

        // Also revoke member consent if a member has this email
        // REQ-018 (E2.S2): normalized lookup so case/+tag variants still resolve to the same member.
        var member = await memberRepository.GetByEmailNormalizedAsync(email);
        if (member?.KeycloakUserId != null)
        {
            var consent = await consentRepository.GetByUserAndTypeAsync(
                member.KeycloakUserId.Value, ConsentType.Newsletter);
            if (consent is { IsGranted: true })
            {
                consent.Revoke();
                await consentRepository.UpdateAsync(consent);
            }
        }

        // Always return success (don't reveal whether email exists)
        return Results.Ok(new
        {
            success = true,
            email = MaskEmail(email),
            message = "If this email was subscribed, it has been unsubscribed."
        });
    }

    /// <summary>
    /// Verify the token-based unsubscribe link (from campaign emails).
    /// </summary>
    private static async Task<IResult> VerifyUnsubscribe(
        [FromServices] IUnsubscribeTokenService tokenService,
        [FromServices] IEmailCampaignRepository campaignRepository,
        string token)
    {
        var recipientId = tokenService.ValidateToken(token);
        if (recipientId == null)
            return Results.BadRequest(new { error = "Invalid or expired unsubscribe link." });

        var recipient = await campaignRepository.GetRecipientByIdAsync(recipientId.Value);
        if (recipient == null)
            return Results.NotFound(new { error = "Recipient not found." });

        if (recipient.UnsubscribedAt.HasValue)
            return Results.Ok(new
            {
                alreadyUnsubscribed = true,
                email = MaskEmail(recipient.Email),
                unsubscribedAt = recipient.UnsubscribedAt
            });

        return Results.Ok(new
        {
            alreadyUnsubscribed = false,
            email = MaskEmail(recipient.Email)
        });
    }

    /// <summary>
    /// Confirm the token-based unsubscribe.
    /// </summary>
    private static async Task<IResult> ConfirmUnsubscribe(
        [FromServices] IUnsubscribeTokenService tokenService,
        [FromServices] IEmailCampaignRepository campaignRepository,
        [FromServices] INewsletterSubscriberRepository subscriberRepository,
        [FromServices] IConsentRepository consentRepository,
        [FromServices] IMemberRepository memberRepository,
        string token)
    {
        var recipientId = tokenService.ValidateToken(token);
        if (recipientId == null)
            return Results.BadRequest(new { error = "Invalid or expired unsubscribe link." });

        var recipient = await campaignRepository.GetRecipientByIdAsync(recipientId.Value);
        if (recipient == null)
            return Results.NotFound(new { error = "Recipient not found." });

        // Mark campaign recipient as unsubscribed
        if (!recipient.UnsubscribedAt.HasValue)
        {
            recipient.MarkAsUnsubscribed();
            await campaignRepository.UpdateRecipientAsync(recipient);
        }

        // Also unsubscribe external subscriber entry
        var subscriber = await subscriberRepository.GetByEmailAsync(recipient.Email);
        if (subscriber is { IsActive: true })
        {
            subscriber.Unsubscribe();
            await subscriberRepository.UpdateAsync(subscriber);
        }

        // Revoke member consent if linked
        if (recipient.MemberId.HasValue)
        {
            var member = await memberRepository.GetByIdAsync(recipient.MemberId.Value);
            if (member?.KeycloakUserId != null)
            {
                var consent = await consentRepository.GetByUserAndTypeAsync(
                    member.KeycloakUserId.Value, ConsentType.Newsletter);
                if (consent is { IsGranted: true })
                {
                    consent.Revoke();
                    await consentRepository.UpdateAsync(consent);
                }
            }
        }

        return Results.Ok(new
        {
            success = true,
            email = MaskEmail(recipient.Email),
            message = "Successfully unsubscribed from newsletter."
        });
    }

    private static string MaskEmail(string email)
    {
        var atIndex = email.IndexOf('@');
        if (atIndex <= 2)
            return email;
        return string.Concat(email.AsSpan(0, 2), new string('*', atIndex - 2), email.AsSpan(atIndex));
    }
}

// Request DTOs
public record NewsletterSubscribeRequest(string Email, string? FirstName = null, string? LastName = null);
public record NewsletterUnsubscribeRequest(string Email);

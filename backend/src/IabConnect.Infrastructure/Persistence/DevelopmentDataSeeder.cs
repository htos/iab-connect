using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Persistence;

/// <summary>
/// Seeds development data by creating Member records for pre-existing Keycloak users.
/// Only runs in Development environment and is idempotent (safe to run multiple times).
/// </summary>
public static class DevelopmentDataSeeder
{
    /// <summary>
    /// Seed users configuration - maps email to member data.
    /// REQ-086 (E9-S3): the brand-specific surname was de-branded to a neutral demo value.
    /// The seed EMAILS are intentionally NOT changed here — they are coupled to the
    /// Keycloak realm seed (infra/keycloak/realms/iabconnect-realm.json, out of scope per
    /// story Dev Notes §B) and the login dev-credentials block; changing them in isolation
    /// would break dev seeding. See story Q2 — de-branding the emails is a coordinated
    /// infra follow-up (realm JSON + seeder + login page together).
    /// </summary>
    private static readonly List<SeedMemberData> SeedMembers =
    [
        new SeedMemberData
        {
            Email = "admin@iabconnect.ch",
            FirstName = "Admin",
            LastName = "Demo",
            MembershipType = MembershipType.Honorary,
            ActivateAfterCreation = true
        },
        new SeedMemberData
        {
            Email = "vorstand@iabconnect.ch",
            FirstName = "Vorstand",
            LastName = "Test",
            MembershipType = MembershipType.Regular,
            ActivateAfterCreation = true
        },
        new SeedMemberData
        {
            Email = "member@iabconnect.ch",
            FirstName = "Mitglied",
            LastName = "Test",
            MembershipType = MembershipType.Regular,
            ActivateAfterCreation = true
        }
    ];

    /// <summary>
    /// Seeds Member records for pre-existing Keycloak users.
    /// Queries Keycloak to get current user IDs and creates corresponding Member records.
    /// </summary>
    /// <param name="serviceProvider">The service provider to resolve dependencies</param>
    /// <param name="cancellationToken">Cancellation token</param>
    public static async Task SeedAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken = default)
    {
        using var scope = serviceProvider.CreateScope();
        var services = scope.ServiceProvider;

        var logger = services.GetRequiredService<ILogger<ApplicationDbContext>>();
        var dbContext = services.GetRequiredService<ApplicationDbContext>();
        var keycloakService = services.GetRequiredService<IKeycloakAdminService>();

        logger.LogInformation("Starting development data seeding...");

        var createdCount = 0;
        var skippedCount = 0;

        foreach (var seedMember in SeedMembers)
        {
            try
            {
                // Check if member already exists by email
                var existingMember = await dbContext.Members
                    .FirstOrDefaultAsync(m => m.Email == seedMember.Email, cancellationToken);

                if (existingMember != null)
                {
                    logger.LogDebug("Member with email {Email} already exists (ID: {MemberId}), skipping",
                        seedMember.Email, existingMember.Id);
                    skippedCount++;

                    // If KeycloakUserId is not set, try to link it
                    if (existingMember.KeycloakUserId == null)
                    {
                        await TryLinkKeycloakUser(existingMember, seedMember.Email, keycloakService, dbContext, logger, cancellationToken);
                    }
                    continue;
                }

                // Query Keycloak to get the user ID
                var keycloakUser = await keycloakService.GetUserByEmailAsync(seedMember.Email, cancellationToken);

                if (keycloakUser == null)
                {
                    logger.LogWarning("Keycloak user with email {Email} not found, skipping member creation",
                        seedMember.Email);
                    continue;
                }

                if (!Guid.TryParse(keycloakUser.Id, out var keycloakUserId))
                {
                    logger.LogWarning("Invalid Keycloak user ID format for {Email}: {KeycloakId}",
                        seedMember.Email, keycloakUser.Id);
                    continue;
                }

                // Check if a member with this Keycloak ID already exists
                var memberByKeycloakId = await dbContext.Members
                    .FirstOrDefaultAsync(m => m.KeycloakUserId == keycloakUserId, cancellationToken);

                if (memberByKeycloakId != null)
                {
                    logger.LogDebug("Member with KeycloakUserId {KeycloakUserId} already exists (different email), skipping",
                        keycloakUserId);
                    skippedCount++;
                    continue;
                }

                // Create the member
                var member = Member.Create(
                    firstName: seedMember.FirstName,
                    lastName: seedMember.LastName,
                    email: seedMember.Email,
                    address: Address.CreateEmpty(),
                    membershipType: seedMember.MembershipType,
                    phone: null
                );

                // Link to Keycloak user
                member.LinkToKeycloak(keycloakUserId);

                // Activate if configured
                if (seedMember.ActivateAfterCreation)
                {
                    member.Activate();
                }

                await dbContext.Members.AddAsync(member, cancellationToken);

                logger.LogInformation("Created Member {MemberId} for Keycloak user {Email} (KeycloakId: {KeycloakUserId})",
                    member.Id, seedMember.Email, keycloakUserId);

                createdCount++;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to seed member with email {Email}", seedMember.Email);
                // Continue with other members
            }
        }

        // Save all changes
        if (createdCount > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Development data seeding completed: {CreatedCount} members created, {SkippedCount} skipped",
                createdCount, skippedCount);
        }
        else
        {
            logger.LogInformation("Development data seeding completed: no new members created ({SkippedCount} already existed)",
                skippedCount);
        }
    }

    /// <summary>
    /// Attempts to link an existing member to their Keycloak user ID
    /// </summary>
    private static async Task TryLinkKeycloakUser(
        Member member,
        string email,
        IKeycloakAdminService keycloakService,
        ApplicationDbContext dbContext,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            var keycloakUser = await keycloakService.GetUserByEmailAsync(email, cancellationToken);

            if (keycloakUser != null && Guid.TryParse(keycloakUser.Id, out var keycloakUserId))
            {
                member.LinkToKeycloak(keycloakUserId);
                dbContext.Members.Update(member);
                await dbContext.SaveChangesAsync(cancellationToken);

                logger.LogInformation("Linked existing member {MemberId} to Keycloak user {KeycloakUserId}",
                    member.Id, keycloakUserId);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to link member {MemberId} to Keycloak user", member.Id);
        }
    }

    /// <summary>
    /// Internal class to hold seed member configuration
    /// </summary>
    private sealed class SeedMemberData
    {
        public required string Email { get; init; }
        public required string FirstName { get; init; }
        public required string LastName { get; init; }
        public MembershipType MembershipType { get; init; } = MembershipType.Regular;
        public bool ActivateAfterCreation { get; init; } = true;
    }
}

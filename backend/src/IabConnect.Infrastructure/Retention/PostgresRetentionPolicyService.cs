using IabConnect.Application.Retention;
using IabConnect.Domain.Operations;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Retention;

/// <summary>
/// REQ-057: PostgreSQL-backed retention policy service.
/// </summary>
public sealed class PostgresRetentionPolicyService(ApplicationDbContext db) : IRetentionPolicyService
{
    public async Task<List<RetentionPolicy>> GetAllPoliciesAsync(CancellationToken ct = default)
    {
        return await db.RetentionPolicies
            .OrderBy(p => p.DataCategory)
            .ToListAsync(ct);
    }

    public async Task<RetentionPolicy?> GetPolicyByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await db.RetentionPolicies.FindAsync([id], ct);
    }

    public async Task<RetentionPolicy?> GetPolicyByCategoryAsync(string dataCategory, CancellationToken ct = default)
    {
        return await db.RetentionPolicies
            .FirstOrDefaultAsync(p => p.DataCategory == dataCategory, ct);
    }

    public async Task<RetentionPolicy> CreatePolicyAsync(RetentionPolicy policy, CancellationToken ct = default)
    {
        db.RetentionPolicies.Add(policy);
        await db.SaveChangesAsync(ct);
        return policy;
    }

    public async Task<RetentionPolicy> UpdatePolicyAsync(RetentionPolicy policy, CancellationToken ct = default)
    {
        db.RetentionPolicies.Update(policy);
        await db.SaveChangesAsync(ct);
        return policy;
    }

    /// <summary>
    /// Seeds default retention policies if none exist.
    /// Called at application startup.
    /// </summary>
    public async Task SeedDefaultPoliciesAsync(CancellationToken ct = default)
    {
        if (await db.RetentionPolicies.AnyAsync(ct))
            return;

        var defaults = new[]
        {
            RetentionPolicy.Create(
                DataCategories.AuditLogs,
                "Audit-Logeinträge",
                24,
                RetentionAction.Anonymize,
                "DSGVO Art. 5(1)(e) – Speicherbegrenzung"),

            RetentionPolicy.Create(
                DataCategories.MemberData,
                "Mitgliederdaten (nach Austritt)",
                36,
                RetentionAction.Anonymize,
                "DSGVO Art. 17 – Recht auf Löschung"),

            RetentionPolicy.Create(
                DataCategories.FinanceData,
                "Finanzdaten & Belege",
                120,
                RetentionAction.Archive,
                "OR Art. 958f – 10 Jahre Aufbewahrungspflicht"),

            RetentionPolicy.Create(
                DataCategories.Documents,
                "Vereinsdokumente",
                60,
                RetentionAction.Archive,
                "Interne Archivierungsrichtlinie"),

            RetentionPolicy.Create(
                DataCategories.Backups,
                "Datenbank-Backups",
                6,
                RetentionAction.Delete,
                "Speicheroptimierung"),

            RetentionPolicy.Create(
                DataCategories.Events,
                "Event-Daten (vergangene)",
                48,
                RetentionAction.Archive,
                "Vereinschronik / Archiv"),
        };

        db.RetentionPolicies.AddRange(defaults);
        await db.SaveChangesAsync(ct);
    }
}

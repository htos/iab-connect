namespace IabConnect.Domain.Common;

/// <summary>
/// Module enablement state (REQ-087, Epic E10). One row per platform module — the row's
/// <see cref="Enabled"/> flag drives navigation, routing and backend enforcement of that
/// module's availability.
///
/// <para>Single-tenant by design (ADR-007): there is no <c>organization_id</c> — the seven
/// rows keyed by <see cref="ModuleKeys"/> are global, exactly like the singleton
/// <see cref="SystemSettings"/>. Mirrors the <c>SystemSettings</c> shape: private setters,
/// a private EF constructor, a <see cref="Create"/> factory, and an explicit
/// <see cref="SetEnabled"/> mutation method that stamps the audit fields.</para>
/// </summary>
public sealed class ModuleSetting : Entity
{
    /// <summary>
    /// Canonical module key — one of the constants in <see cref="ModuleKeys"/>. Unique.
    /// </summary>
    public string ModuleKey { get; private set; } = string.Empty;

    /// <summary>
    /// Whether the module is enabled. Defaults to <c>true</c> (behaviour-preserving).
    /// </summary>
    public bool Enabled { get; private set; } = true;

    /// <summary>
    /// Timestamp of the last enablement change.
    /// </summary>
    public DateTime UpdatedAt { get; private set; }

    /// <summary>
    /// User who last changed the enablement state. <c>null</c> for the seeded rows.
    /// </summary>
    public string? UpdatedBy { get; private set; }

    // EF Core constructor
    private ModuleSetting() { }

    /// <summary>
    /// Create a module setting for <paramref name="moduleKey"/>. The key must be non-blank
    /// and one of the seven canonical <see cref="ModuleKeys"/> constants — the domain
    /// invariant "a module setting is one of the known modules" is asserted here, not just
    /// at the database unique index.
    /// </summary>
    public static ModuleSetting Create(string moduleKey, bool enabled, string? updatedBy)
    {
        if (string.IsNullOrWhiteSpace(moduleKey))
            throw new ArgumentException("Module key cannot be empty.", nameof(moduleKey));

        var normalizedKey = moduleKey.Trim();
        if (!ModuleKeys.All.Contains(normalizedKey))
        {
            throw new ArgumentException(
                $"'{normalizedKey}' is not a known module key. Expected one of: {string.Join(", ", ModuleKeys.All)}.",
                nameof(moduleKey));
        }

        return new ModuleSetting
        {
            ModuleKey = normalizedKey,
            Enabled = enabled,
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = updatedBy,
        };
    }

    /// <summary>
    /// Set the module's enablement state and stamp the audit fields.
    /// </summary>
    public void SetEnabled(bool enabled, string? updatedBy)
    {
        Enabled = enabled;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }
}

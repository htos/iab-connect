namespace IabConnect.Domain.Common;

/// <summary>
/// Single source of truth for the platform's module-key strings (REQ-087, Epic E10).
///
/// <para>A "module" is a top-level functional area whose availability is admin-configurable
/// via the <see cref="ModuleSetting"/> entity. These constants are the canonical keys used by
/// the seed migration, the module-settings service/repository, backend enforcement
/// (E10-S3) and frontend enforcement (E10-S4) — so a key is never spelled as a literal in
/// more than one place.</para>
///
/// <para>Placed in <c>IabConnect.Domain</c> because it is a cross-layer contract: both
/// <c>IabConnect.Api</c> and <c>IabConnect.Application</c> reference Domain, whereas the
/// analogous <c>Roles</c> constants live in <c>IabConnect.Api</c> and are not reachable from
/// Application.</para>
/// </summary>
public static class ModuleKeys
{
    public const string Members = "members";
    public const string Events = "events";
    public const string Documents = "documents";
    public const string Communication = "communication";
    public const string Finance = "finance";
    public const string Partners = "partners";
    public const string PublicView = "public_view";

    /// <summary>
    /// REQ-058 (E8-S1): the external integration surface (external read API + webhooks). Gates the
    /// consumer routes only (<c>.RequireAuthorization("Module:api")</c>) — never the admin
    /// credential/webhook-management endpoints, which would self-lock an admin out of re-enabling it.
    /// </summary>
    public const string Api = "api";

    /// <summary>
    /// All module keys, in canonical order. Used by the seed migration and by callers that
    /// need to enumerate or validate the full set of modules.
    /// </summary>
    public static readonly IReadOnlyList<string> All =
    [
        Members,
        Events,
        Documents,
        Communication,
        Finance,
        Partners,
        PublicView,
        Api,
    ];
}

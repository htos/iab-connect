namespace IabConnect.Domain.Integration;

/// <summary>
/// REQ-058 (E8-S1): the closed set of scope strings an <see cref="ApiClient"/> can be granted.
///
/// <para>Mirrors <see cref="IabConnect.Domain.Common.ModuleKeys"/> — a single source of truth so a
/// scope is never spelled as a literal in more than one place. Scopes are OAuth-style
/// <c>resource:action</c> strings, enforced by the <c>Scope:</c> authorization policy prefix
/// (E8-S1) and attached to the concrete external read endpoints by E8-S2.</para>
///
/// <para>v1 (E8-S2) exposes only published Events and Blog posts, so only the matching read scopes
/// are defined. Adding a scope is additive: declare the const, append it to <see cref="All"/>, and
/// no enum-migration churn follows (DEC-2 = string set over enum).</para>
/// </summary>
public static class ApiScopes
{
    /// <summary>Read access to the published-events external surface (E8-S2).</summary>
    public const string EventsRead = "events:read";

    /// <summary>Read access to the published-blog external surface (E8-S2).</summary>
    public const string BlogRead = "blog:read";

    /// <summary>
    /// All scope strings, in canonical order. The write boundary validates a granted scope set is
    /// a subset of this list; an unknown scope is rejected (400).
    /// </summary>
    public static readonly IReadOnlyList<string> All =
    [
        EventsRead,
        BlogRead,
    ];

    /// <summary>True when every scope in <paramref name="scopes"/> is a member of <see cref="All"/>.</summary>
    public static bool AreAllKnown(IEnumerable<string> scopes) => scopes.All(All.Contains);
}

namespace IabConnect.Api.Authorization;

/// <summary>
/// Single source of truth for Keycloak realm role names (Epic-3-retro §9 / R3-Defer-5).
///
/// <para>Before this class, the role-string lists were duplicated: every
/// <c>AddPolicy(... RequireRole("admin", ...))</c> in <c>DependencyInjection</c>, the
/// <c>StaffRoles</c> array in <c>EventVolunteerEndpoints</c>, and assorted inline
/// <c>RequireRole</c>/<c>IsInRole</c> checks each spelled the strings out. A role rename or a
/// new staff role meant hunting every literal. Authorization policies and inline role checks
/// now reference these constants — and the <see cref="EventStaff"/> set in particular — so the
/// staff-vs-member determination reads from one place.</para>
/// </summary>
public static class Roles
{
    public const string Admin = "admin";
    public const string Vorstand = "vorstand";
    public const string EventManager = "event-manager";
    public const string Member = "member";
    public const string Kassier = "kassier";
    public const string Auditor = "auditor";

    /// <summary>
    /// Realm roles that satisfy the <c>RequireEventStaff</c> policy. Referenced by both the
    /// policy definition in <c>DependencyInjection</c> and the <c>IsStaffCaller</c> check in
    /// <c>EventVolunteerEndpoints</c> so the two can never drift (R3-Defer-5).
    /// </summary>
    public static readonly string[] EventStaff = [Admin, Vorstand, EventManager];
}

namespace IabConnect.Domain.Common;

/// <summary>
/// Cross-cutting plumbing for the project-wide "DateTime fields are always UTC" invariant.
///
/// Closes a family of findings raised by the Epic-3 boundary review (H-S1-2 CSV CheckedInAt,
/// H-S5-2 ICS DTSTART/DTEND, part of C3 S4 reminder times): downstream exporters call
/// <see cref="DateTime.ToUniversalTime"/> and the result silently shifts the wall-clock when the
/// stored value has <see cref="DateTimeKind.Unspecified"/>. By enforcing <see cref="DateTimeKind.Utc"/>
/// at the domain boundary, those exporters can trust their inputs.
///
/// Policy:
/// <list type="bullet">
///   <item><c>Kind == Utc</c> — passes through unchanged.</item>
///   <item><c>Kind == Local</c> — converted via <see cref="DateTime.ToUniversalTime"/>.</item>
///   <item><c>Kind == Unspecified</c> — relabelled as UTC via <see cref="DateTime.SpecifyKind"/>.
///         "Wall time at unknown TZ" is not a meaningful concept for stored timestamps in this
///         domain; treating it as already-UTC matches the historical Npgsql round-trip behaviour
///         and avoids breaking the existing call sites that build dates via <c>new DateTime(...)</c>
///         in tests.</item>
/// </list>
/// </summary>
public static class DateTimeUtcGuard
{
    public static DateTime EnsureUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };

    public static DateTime? EnsureUtc(DateTime? value) =>
        value.HasValue ? EnsureUtc(value.Value) : null;
}

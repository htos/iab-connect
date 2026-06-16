using IabConnect.Domain.Members;
using DomainMembershipStatus = IabConnect.Domain.Members.MembershipStatus;
using DomainMembershipType = IabConnect.Domain.Members.MembershipType;

namespace IabConnect.Application.Members.Segments;

/// <summary>
/// REQ-017: Dynamic member-segment filter criteria, stored as JSON in
/// <c>MemberSegment.CriteriaJson</c>. Relocated from <c>MemberSegmentEndpoints</c> (Api) to the
/// Application layer (REQ-028 E5-S1, DEC-3) so the criteria-application logic is single-source —
/// consumed by both the member-segment endpoint and the new
/// <c>IRecipientResolutionService</c> (which resolves automation/campaign recipients from a
/// segment) without the lower layers depending on the Api layer.
/// </summary>
public sealed class SegmentCriteria
{
    public string[]? Status { get; set; }
    public string[]? Type { get; set; }
    public DateRange? MemberSince { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
}

/// <summary>Inclusive date range used by <see cref="SegmentCriteria.MemberSince"/>.</summary>
public sealed class DateRange
{
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}

/// <summary>
/// REQ-017: Pure, single-source evaluator that translates a <see cref="SegmentCriteria"/> into an
/// EF <see cref="IQueryable{Member}"/> predicate chain. The exact behaviour relocated verbatim
/// from the former <c>MemberSegmentEndpoints.ApplyCriteria</c>.
/// </summary>
public static class MemberSegmentCriteria
{
    public static IQueryable<Member> Apply(IQueryable<Member> query, SegmentCriteria criteria)
    {
        if (criteria.Status is { Length: > 0 })
        {
            var statuses = criteria.Status
                .Select(s => Enum.TryParse<DomainMembershipStatus>(s, true, out var v) ? v : (DomainMembershipStatus?)null)
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();

            if (statuses.Count > 0)
                query = query.Where(m => statuses.Contains(m.Status));
        }

        if (criteria.Type is { Length: > 0 })
        {
            var types = criteria.Type
                .Select(t => Enum.TryParse<DomainMembershipType>(t, true, out var v) ? v : (DomainMembershipType?)null)
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();

            if (types.Count > 0)
                query = query.Where(m => types.Contains(m.MembershipType));
        }

        if (criteria.MemberSince != null)
        {
            if (criteria.MemberSince.From.HasValue)
                query = query.Where(m => m.MemberSince >= criteria.MemberSince.From.Value);

            if (criteria.MemberSince.To.HasValue)
                query = query.Where(m => m.MemberSince <= criteria.MemberSince.To.Value);
        }

        if (!string.IsNullOrWhiteSpace(criteria.City))
        {
            var city = criteria.City.ToLower();
            query = query.Where(m => m.Address.City.ToLower().Contains(city));
        }

        if (!string.IsNullOrWhiteSpace(criteria.Country))
        {
            var country = criteria.Country.ToLower();
            query = query.Where(m => m.Address.Country.ToLower().Contains(country));
        }

        return query;
    }
}

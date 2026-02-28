namespace IabConnect.Application.Common;

/// <summary>
/// Helper for sorting, filtering, and paginating in-memory collections.
/// Used by query handlers to apply standard pagination from API query parameters.
/// </summary>
public static class PaginationHelper
{
    /// <summary>
    /// Parse a sort string "field:asc" or "field:desc" into its parts.
    /// </summary>
    public static (string Field, bool Descending) ParseSort(
        string? sort, string defaultField = "createdAt", bool defaultDescending = true)
    {
        if (string.IsNullOrWhiteSpace(sort))
            return (defaultField, defaultDescending);

        var parts = sort.Split(':');
        var field = parts[0].Trim();
        var desc = parts.Length > 1 &&
                   parts[1].Trim().Equals("desc", StringComparison.OrdinalIgnoreCase);

        return (field, desc);
    }

    /// <summary>
    /// Parse a comma-separated filter string "key1=value1,key2=value2".
    /// </summary>
    public static Dictionary<string, string> ParseFilter(string? filter)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(filter)) return result;

        foreach (var pair in filter.Split(','))
        {
            var kv = pair.Split('=', 2);
            if (kv.Length == 2 && !string.IsNullOrWhiteSpace(kv[0]))
                result[kv[0].Trim()] = kv[1].Trim();
        }

        return result;
    }

    /// <summary>
    /// Apply pagination to a pre-sorted/filtered enumerable.
    /// Clamps page (min 1) and pageSize (1..100).
    /// </summary>
    public static PagedResult<T> ToPagedResult<T>(
        this IEnumerable<T> source,
        int page = 1,
        int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var items = source as IList<T> ?? source.ToList();
        var totalCount = items.Count;
        var pagedItems = items.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return new PagedResult<T>
        {
            Items = pagedItems,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    /// <summary>
    /// Apply an ordering to an enumerable using a key selector, supporting ascending/descending.
    /// </summary>
    public static IEnumerable<T> ApplySort<T, TKey>(
        this IEnumerable<T> source,
        Func<T, TKey> keySelector,
        bool descending)
    {
        return descending
            ? source.OrderByDescending(keySelector)
            : source.OrderBy(keySelector);
    }
}

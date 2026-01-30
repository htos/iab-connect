namespace IabConnect.Application.Common;

/// <summary>
/// Generic paginated result wrapper
/// </summary>
public sealed class PagedResult<T>
{
    public required IReadOnlyList<T> Items { get; init; }
    public required int TotalCount { get; init; }
    public required int Page { get; init; }
    public required int PageSize { get; init; }
    
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;

    public static PagedResult<T> Empty(int page, int pageSize) => new()
    {
        Items = [],
        TotalCount = 0,
        Page = page,
        PageSize = pageSize
    };
}

/// <summary>
/// Generic result wrapper for operations
/// </summary>
public sealed class Result<T>
{
    public bool IsSuccess { get; private init; }
    public T? Value { get; private init; }
    public string? Error { get; private init; }

    private Result() { }

    public static Result<T> Success(T value) => new()
    {
        IsSuccess = true,
        Value = value
    };

    public static Result<T> Failure(string error) => new()
    {
        IsSuccess = false,
        Error = error
    };
}

/// <summary>
/// Result without value
/// </summary>
public sealed class Result
{
    public bool IsSuccess { get; private init; }
    public string? Error { get; private init; }

    private Result() { }

    public static Result Success() => new() { IsSuccess = true };
    public static Result Failure(string error) => new() { IsSuccess = false, Error = error };
}

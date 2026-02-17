using FluentValidation;

namespace IabConnect.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning(ex, "Validation failed for {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "application/problem+json";

            var errors = ex.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

            var problem = new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.5.1",
                title = "Validation Failed",
                status = 400,
                detail = "One or more validation errors occurred.",
                errors
            };

            await context.Response.WriteAsJsonAsync(problem);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Business rule violation for {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            context.Response.ContentType = "application/problem+json";

            var problem = new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.5.10",
                title = "Business Rule Violation",
                status = 409,
                detail = ex.Message
            };

            await context.Response.WriteAsJsonAsync(problem);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid argument for {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "application/problem+json";

            var problem = new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.5.1",
                title = "Bad Request",
                status = 400,
                detail = ex.Message
            };

            await context.Response.WriteAsJsonAsync(problem);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Resource not found for {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            context.Response.ContentType = "application/problem+json";

            var problem = new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.5.5",
                title = "Not Found",
                status = 404,
                detail = ex.Message
            };

            await context.Response.WriteAsJsonAsync(problem);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access for {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/problem+json";

            var problem = new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.5.4",
                title = "Forbidden",
                status = 403,
                detail = ex.Message
            };

            await context.Response.WriteAsJsonAsync(problem);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception for {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";

            var problem = new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.6.1",
                title = "Internal Server Error",
                status = 500,
                detail = "An unexpected error occurred. Please try again later."
            };

            await context.Response.WriteAsJsonAsync(problem);
        }
    }
}

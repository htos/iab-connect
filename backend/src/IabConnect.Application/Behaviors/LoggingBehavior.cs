using MediatR;
using Microsoft.Extensions.Logging;
using System.Diagnostics;

namespace IabConnect.Application;

/// <summary>
/// Logging behavior for MediatR pipeline
/// Logs request/response times and any exceptions
/// </summary>
public sealed class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;

    public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    {
        _logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        var requestId = Guid.NewGuid().ToString("N")[..8];

        _logger.LogInformation(
            "Handling {RequestName} [{RequestId}]",
            requestName, requestId);

        var stopwatch = Stopwatch.StartNew();

        try
        {
            var response = await next();
            stopwatch.Stop();

            _logger.LogInformation(
                "Handled {RequestName} [{RequestId}] in {ElapsedMs}ms",
                requestName, requestId, stopwatch.ElapsedMilliseconds);

            return response;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();

            _logger.LogError(ex,
                "Error handling {RequestName} [{RequestId}] after {ElapsedMs}ms",
                requestName, requestId, stopwatch.ElapsedMilliseconds);

            throw;
        }
    }
}

using FluentValidation;
using IabConnect.Application.Authorization;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.FiscalPeriods;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

namespace IabConnect.Application;

/// <summary>
/// Application layer dependency injection configuration
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        // MediatR
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
        });

        // FluentValidation
        services.AddValidatorsFromAssembly(assembly);

        // REQ-004: Authorization services
        services.AddScoped<IAuthorizationService, AuthorizationService>();
        services.AddScoped<ISecurityAuditLogger, SecurityAuditLogger>();

        // REQ-066: Fiscal period locking service
        services.AddScoped<IFiscalPeriodService, FiscalPeriodService>();

        // Auto-booking: create ledger transactions on financial events
        services.AddScoped<IAutoBookingService, AutoBookingService>();

        // Note: IAuditService is registered in Infrastructure layer (requires IHttpContextAccessor)

        return services;
    }
}

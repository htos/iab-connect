using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hangfire;
using IabConnect.Api.Authorization;
using IabConnect.Api.Middleware;
using IabConnect.Infrastructure.Common;
using IabConnect.Infrastructure.Finance.Jobs;
using IabConnect.Infrastructure.Events.Jobs;
using IabConnect.Infrastructure.Retention;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;

[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("IabConnect.Api.Tests")]

namespace IabConnect.Api;

/// <summary>
/// API layer dependency injection configuration
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// REQ-024 (E3.S4 R4-P-S4-3): recurring-job id + cron for the daily volunteer-shift
    /// reminder pass. Extracted as constants so the registration is assertable by
    /// <c>VolunteerShiftReminderJobRegistrationTests</c> without standing up Hangfire storage.
    /// </summary>
    internal const string VolunteerReminderJobId = "send-volunteer-shift-reminders";

    /// <summary>Cron expression for the volunteer-reminder job — daily at 09:00 (job timezone).</summary>
    internal const string VolunteerReminderCron = "0 9 * * *";

    /// <summary>
    /// REQ-088 (E11-S2 / ADR-020): recurring-job id for the weekly retention-enforcement pass.
    /// Extracted so <c>RetentionEnforcementJobRegistrationTests</c> can assert
    /// presence/absence by id without standing up Hangfire storage. The job registration is
    /// gated by <c>RetentionEnforcement:Enabled</c> (default true) so Beta deployments
    /// (which set the flag to false in <c>appsettings.Beta.json</c>) do not retention-delete
    /// tester data while retention defaults are still being validated.
    /// </summary>
    internal const string RetentionJobId = "enforce-retention-policies";

    public static IServiceCollection AddApiServices(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        // Configure JSON serialization to use string enums and camelCase
        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        });

        // REQ-089 AC-5 (E20-S3) / ADR-021: Branding options carry the AGPL §13
        // source-disclosure URL projected by the `/about` endpoint. Bound here so
        // the IOptions<BrandingOptions> handler dependency in AboutEndpoints.cs
        // resolves out of DI without any per-endpoint configuration plumbing.
        services.Configure<BrandingOptions>(configuration.GetSection("Branding"));

        // OpenAPI / Swagger
        // REQ-086 (E9-S3): title/description are config-driven (Branding:*) with literal
        // defaults that exactly preserve the previous values. Configured at startup before
        // the DB is reliable, so this reads IConfiguration — not SystemSettings.
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = configuration["Branding:ApiTitle"] ?? "IAB Connect API",
                Version = "v1",
                Description = configuration["Branding:ApiDescription"]
                    ?? "API für die Webanwendung des Indischen Kulturvereins Bern"
            });

            // Bearer token authentication for Swagger UI
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
                Name = "Authorization",
                In = ParameterLocation.Header,
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT"
            });

            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference
                        {
                            Type = ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                    },
                    Array.Empty<string>()
                }
            });
        });

        // CORS
        services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
            {
                var frontendUrl = configuration["Frontend:BaseUrl"] ?? "http://localhost:3000";

                if (environment.IsDevelopment() || environment.EnvironmentName == "Testing")
                {
                    // In development, be more permissive
                    policy
                        .WithOrigins(frontendUrl, "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001")
                        .AllowAnyMethod()
                        .AllowAnyHeader()
                        .AllowCredentials();
                }
                else
                {
                    // In production, be strict
                    policy
                        .WithOrigins(frontendUrl)
                        .AllowAnyMethod()
                        .AllowAnyHeader()
                        .AllowCredentials();
                }
            });
        });

        // Authentication & Authorization with Keycloak
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                var keycloakSection = configuration.GetSection("Keycloak");
                options.Authority = keycloakSection["Authority"];
                options.Audience = keycloakSection["ClientId"];
                options.RequireHttpsMetadata = !(environment.IsDevelopment() || environment.EnvironmentName == "Testing"); // Only allow HTTP in development/testing

                // Disable automatic claim mapping to preserve original claim names (e.g., "sub")
                options.MapInboundClaims = false;

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = false, // Keycloak tokens may not have audience
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    NameClaimType = "preferred_username",
                    RoleClaimType = ClaimTypes.Role
                };

                // Map Keycloak roles to standard role claims
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = context =>
                    {
                        MapKeycloakRolesToClaims(context);
                        return Task.CompletedTask;
                    }
                };
            });

        // Authorization policies based on roles. Role-name strings come from the Roles
        // single-source-of-truth (Epic-3-retro §9 / R3-Defer-5).
        services.AddAuthorizationBuilder()
            .AddPolicy("RequireAdmin", policy =>
                policy.RequireRole(Roles.Admin))
            .AddPolicy("RequireVorstand", policy =>
                policy.RequireRole(Roles.Admin, Roles.Vorstand))
            .AddPolicy("RequireMember", policy =>
                policy.RequireRole(Roles.Admin, Roles.Vorstand, Roles.Member))
            .AddPolicy("RequireEventStaff", policy =>
                policy.RequireRole(Roles.EventStaff))
            // REQ-024 (E3.S3 Round-3 R3-DN-4): union policy for the volunteer-shift read surface.
            // RequireMember excludes the `event-manager` role; an event-manager who isn't ALSO
            // an admin/vorstand/member cannot GET the volunteer shifts they manage via the
            // staff-policy. RequireEventStaffOrMember accepts both groups so reads are open to
            // every legitimate viewer without leaking write access (the write endpoints still
            // gate on RequireEventStaff). Decision DN-4 picked this option (b) over (a)
            // (loosening RequireMember) because RequireMember semantically means "member-or-
            // higher" and adding event-manager would muddle that meaning across the rest of the
            // codebase.
            .AddPolicy("RequireEventStaffOrMember", policy =>
                policy.RequireRole(Roles.Admin, Roles.Vorstand, Roles.Member, Roles.EventManager))
            .AddPolicy("RequireFinanceRead", policy =>
                policy.RequireRole(Roles.Admin, Roles.Kassier, Roles.Auditor))
            .AddPolicy("RequireFinanceWrite", policy =>
                policy.RequireRole(Roles.Admin, Roles.Kassier))
            .AddPolicy("RequireSearch", policy =>
                policy.RequireRole(Roles.Admin, Roles.Vorstand, Roles.Kassier));

        // REQ-004: Permission-based authorization handler
        services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
        services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();

        // REQ-087 (E10-S3): module-enforcement handler. Registered Scoped — unlike the
        // Singleton permission handler — because it resolves the scoped IModuleSettingsService
        // and IAuditService. PermissionPolicyProvider above also serves the "Module:" prefix.
        services.AddScoped<IAuthorizationHandler, ModuleAuthorizationHandler>();

        // REQ-054: Health Checks with DB & Keycloak probes
        services.AddHealthChecks()
            .AddCheck<HealthChecks.DatabaseHealthCheck>("database", tags: ["db", "ready"])
            .AddCheck<HealthChecks.KeycloakHealthCheck>("keycloak", tags: ["auth", "ready"]);

        return services;
    }

    private static void MapKeycloakRolesToClaims(TokenValidatedContext context)
    {
        if (context.Principal?.Identity is not ClaimsIdentity identity) return;

        // Extract roles from realm_access claim (Keycloak format)
        var realmAccessClaim = context.Principal.FindFirst("realm_access");
        if (realmAccessClaim != null)
        {
            try
            {
                var realmAccess = System.Text.Json.JsonDocument.Parse(realmAccessClaim.Value);
                if (realmAccess.RootElement.TryGetProperty("roles", out var roles))
                {
                    foreach (var role in roles.EnumerateArray())
                    {
                        var roleValue = role.GetString();
                        if (!string.IsNullOrEmpty(roleValue))
                        {
                            identity.AddClaim(new Claim(ClaimTypes.Role, roleValue));
                        }
                    }
                }
            }
            catch
            {
                // Ignore JSON parsing errors
            }
        }
    }

    public static WebApplication UseApiPipeline(this WebApplication app)
    {
        // Security headers
        app.Use(async (context, next) =>
        {
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            context.Response.Headers["X-Frame-Options"] = "DENY";
            context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            context.Response.Headers["X-Permitted-Cross-Domain-Policies"] = "none";
            await next();
        });

        if (!app.Environment.IsDevelopment() && app.Environment.EnvironmentName != "Testing")
        {
            app.UseHsts();
        }

        // REQ-054: Correlation ID tracking (before exception handling)
        app.UseMiddleware<CorrelationIdMiddleware>();

        // Global exception handling
        app.UseMiddleware<ExceptionHandlingMiddleware>();

        // Development
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            var swaggerApiTitle = app.Configuration["Branding:ApiTitle"] ?? "IAB Connect API";
            app.UseSwaggerUI(options =>
            {
                options.SwaggerEndpoint("/swagger/v1/swagger.json", $"{swaggerApiTitle} v1");
                options.RoutePrefix = "swagger";
            });
        }

        // Security
        if (!app.Environment.IsDevelopment() && app.Environment.EnvironmentName != "Testing")
        {
            app.UseHttpsRedirection();
        }
        app.UseCors("AllowFrontend");

        // Serilog request logging
        app.UseSerilogRequestLogging();

        // Auth
        app.UseAuthentication();
        app.UseAuthorization();

        // Hangfire Dashboard (dev only) + recurring jobs
        if (app.Environment.IsDevelopment())
        {
            app.UseHangfireDashboard("/hangfire");
        }

        // Register recurring background jobs (skip in Testing — no Hangfire storage available)
        if (app.Environment.EnvironmentName != "Testing")
        {
            var jobManager = app.Services.GetRequiredService<IRecurringJobManager>();

            jobManager.AddOrUpdate<MarkInvoicesOverdueJob>(
                "mark-invoices-overdue",
                job => job.ExecuteAsync(CancellationToken.None),
                Cron.Daily,
                new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

            jobManager.AddOrUpdate<DunningScheduleGenerationJob>(
                "generate-dunning-notices",
                job => job.ExecuteAsync(CancellationToken.None),
                Cron.Weekly,
                new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

            // REQ-088 (E11-S2): retention enforcement is suppressed in Beta per ADR-020 so
            // tester data is not deleted by default-policy retention rules during the
            // validation window. Extracted as a static helper so the flag-conditional
            // registration is unit-testable without standing up Hangfire storage.
            RegisterRetentionEnforcementJob(app.Configuration, jobManager);

            // REQ-024 (E3.S4): Daily 09:00 Europe/Zurich (first non-UTC schedule in the project).
            // Local timezone matches the operations expectation that recipients see the reminder
            // on the morning of the day BEFORE their shift in their own time.
            // REQ-024 (E3.S4 review M-S4-5): Windows containers without ICU cannot resolve the
            // IANA id "Europe/Zurich" and would crash on boot. Try the Windows id, then UTC
            // as a last resort; log loudly so the operator notices the degraded schedule.
            var reminderJobTimeZone = ResolveReminderJobTimeZone(
                app.Services.GetRequiredService<ILogger<RecurringJobOptions>>());
            jobManager.AddOrUpdate<VolunteerShiftReminderJob>(
                VolunteerReminderJobId,
                job => job.ExecuteAsync(CancellationToken.None),
                VolunteerReminderCron,
                new RecurringJobOptions { TimeZone = reminderJobTimeZone });
        }

        // REQ-054: Health check endpoints (basic + detailed)
        app.MapHealthChecks("/health");
        app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("ready"),
            ResponseWriter = WriteHealthCheckResponse
        });
        app.MapGet("/health/detail", async (
            Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckService healthCheckService) =>
        {
            var report = await healthCheckService.CheckHealthAsync();
            var response = new
            {
                status = report.Status.ToString(),
                totalDuration = report.TotalDuration.TotalMilliseconds,
                entries = report.Entries.Select(e => new
                {
                    name = e.Key,
                    status = e.Value.Status.ToString(),
                    description = e.Value.Description,
                    duration = e.Value.Duration.TotalMilliseconds,
                    exception = e.Value.Exception?.Message
                })
            };
            return report.Status == Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Healthy
                ? Results.Ok(response)
                : Results.Json(response, statusCode: 503);
        }).RequireAuthorization("RequireAdmin");

        // API Endpoints
        app.MapApiEndpoints();

        return app;
    }

    /// <summary>
    /// REQ-088 (E11-S2 / ADR-020): registers the weekly retention-enforcement recurring job
    /// IFF <c>RetentionEnforcement:Enabled</c> is true (default). Beta deployments set the
    /// flag to false in <c>appsettings.Beta.json</c> so tester data is not deleted by
    /// default-policy retention rules during the validation window. Extracted as
    /// <c>internal static</c> so <c>RetentionEnforcementJobRegistrationTests</c> can verify
    /// both flag states with a stubbed <see cref="IRecurringJobManager"/>.
    /// </summary>
    internal static void RegisterRetentionEnforcementJob(IConfiguration configuration, IRecurringJobManager jobManager)
    {
        if (configuration.GetValue<bool>("RetentionEnforcement:Enabled", defaultValue: true))
        {
            jobManager.AddOrUpdate<RetentionEnforcementJob>(
                RetentionJobId,
                job => job.ExecuteAsync(CancellationToken.None),
                Cron.Weekly,
                new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
        }
        else
        {
            // ADR-020 / E11-S2 review D4: when the flag flips from true → false on an
            // existing deployment, Hangfire's recurringjob table still holds the
            // previously-registered schedule. AddOrUpdate is idempotent for the on-state
            // but does NOT clean up on the off-state — RemoveIfExists does. Without this,
            // a Beta deployment that ran under the E11-S1 baseline (defaults to true)
            // and then deploys E11-S2 with the flag set to false would still run the
            // retention job weekly, silently deleting tester data — defeating ADR-020.
            jobManager.RemoveIfExists(RetentionJobId);
        }
    }

    /// <summary>
    /// REQ-024 (E3.S4 review M-S4-5): Resolves the Europe/Zurich timezone with a Windows
    /// fallback. Tries the IANA id first (Linux / macOS / Windows-with-ICU), then the legacy
    /// Windows id, then UTC as a last-ditch fallback so the recurring job still registers
    /// instead of crashing the API at boot. Logs a warning when a fallback is used so ops
    /// can fix the host configuration.
    /// </summary>
    internal static TimeZoneInfo ResolveReminderJobTimeZone(Microsoft.Extensions.Logging.ILogger logger)
    {
        foreach (var id in new[] { "Europe/Zurich", "W. Europe Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        // REQ-024 (E3.S4 Round-3 R3-M-S4-2): promoted from LogWarning to LogError because the
        // fallback to UTC is operationally significant — the daily 09:00 Zurich schedule turns
        // into a 09:00 UTC schedule, so reminders fire 1-2 hours earlier than expected. An
        // operator scanning the log levels would never see the warning; an error is the right
        // signal that the deploy needs ICU (Windows) or tzdata (Linux) installed before this
        // becomes the production cadence. Production hosts should fail health-check on this
        // fallback (TODO follow-up: wire a readiness probe to surface it).
        logger.LogError(
            "VolunteerShiftReminder: Europe/Zurich timezone could not be resolved on this host; falling back to UTC for the recurring schedule. Install ICU (Windows) or tzdata (Linux) to restore local-time semantics.");
        return TimeZoneInfo.Utc;
    }

    /// <summary>
    /// REQ-054: Writes a JSON response for the /health/ready endpoint.
    /// </summary>
    private static async Task WriteHealthCheckResponse(HttpContext context, Microsoft.Extensions.Diagnostics.HealthChecks.HealthReport report)
    {
        context.Response.ContentType = "application/json";
        var result = System.Text.Json.JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description
            })
        });
        await context.Response.WriteAsync(result);
    }

}

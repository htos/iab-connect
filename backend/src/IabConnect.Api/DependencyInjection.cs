using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;

namespace IabConnect.Api;

/// <summary>
/// API layer dependency injection configuration
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApiServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Configure JSON serialization to use string enums and camelCase
        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        });

        // OpenAPI / Swagger
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "IAB Connect API",
                Version = "v1",
                Description = "API für die Webanwendung des Indischen Kulturvereins Bern"
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
                policy
                    .WithOrigins(frontendUrl)
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .AllowCredentials();
            });
        });

        // Authentication & Authorization with Keycloak
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                var keycloakSection = configuration.GetSection("Keycloak");
                options.Authority = keycloakSection["Authority"];
                options.Audience = keycloakSection["ClientId"];
                options.RequireHttpsMetadata = !IsDevEnvironment();

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

        // Authorization policies based on roles
        services.AddAuthorizationBuilder()
            .AddPolicy("RequireAdmin", policy =>
                policy.RequireRole("admin"))
            .AddPolicy("RequireVorstand", policy =>
                policy.RequireRole("admin", "vorstand"))
            .AddPolicy("RequireMember", policy =>
                policy.RequireRole("admin", "vorstand", "member"));

        // Health Checks
        services.AddHealthChecks();

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
        // Development
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI(options =>
            {
                options.SwaggerEndpoint("/swagger/v1/swagger.json", "IAB Connect API v1");
                options.RoutePrefix = "swagger";
            });
        }

        // Security
        app.UseHttpsRedirection();
        app.UseCors("AllowFrontend");

        // Serilog request logging
        app.UseSerilogRequestLogging();

        // Auth
        app.UseAuthentication();
        app.UseAuthorization();

        // Health checks
        app.MapHealthChecks("/health");

        // API Endpoints
        app.MapApiEndpoints();

        return app;
    }

    private static bool IsDevEnvironment()
    {
        return Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";
    }
}

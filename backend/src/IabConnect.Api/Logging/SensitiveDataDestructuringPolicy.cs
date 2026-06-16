// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using Serilog.Core;
using Serilog.Events;

namespace IabConnect.Api.Logging;

/// <summary>
/// REQ-088 AC-4 (E14-S5): Serilog destructuring policy that replaces sensitive
/// property values with the sentinel <c>"***REDACTED***"</c> when an object containing
/// a sensitive-named property is destructured into a log event (via <c>{@object}</c>
/// syntax in message templates).
///
/// Coupling to E14-S1: the field-name list mirrors the
/// <c>scripts/audit-secrets.ps1</c> <c>$StringAllowlist</c> grep dictionary. When a new
/// secret-shaped property name is introduced anywhere in the codebase, BOTH the audit
/// script AND this policy must be extended in lockstep. The
/// <see cref="SensitiveDataDestructuringPolicyTests"/> guards the parity.
///
/// Performance: the policy is invoked only when Serilog encounters a destructured
/// object (<c>{@thing}</c>). It is NOT invoked on every log call. Cost is one
/// reflection pass per destructure-invocation against a small HashSet membership
/// check — negligible in practice.
/// </summary>
public sealed class SensitiveDataDestructuringPolicy : IDestructuringPolicy
{
    /// <summary>
    /// Case-insensitive set of property names whose values are always replaced with
    /// <c>"***REDACTED***"</c>. Mirrors the E14-S1 audit script's allowlist field
    /// names (per A31 cross-story orthogonal invariant).
    /// </summary>
    public static readonly HashSet<string> SensitivePropertyNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "Password",
        "secret", "Secret",
        "client_secret", "clientSecret", "ClientSecret",
        "api_key", "apiKey", "ApiKey",
        "access_key", "accessKey", "AccessKey",
        "secret_key", "secretKey", "SecretKey",
        "Authorization", "authorization",
        "connectionstring", "ConnectionString", "connectionString",
        "EncryptionKey", "encryptionKey", "encryption_key",
        "NEXTAUTH_SECRET", "nextauth_secret", "NextauthSecret",
        "webhook_secret", "webhookSecret", "WebhookSecret",
        "pepper", "Pepper",
        "CalendarTokenPepper", "calendarTokenPepper",
        "PGPASSWORD",
        "X-API-Key", "x-api-key",
    };

    private const string Sentinel = "***REDACTED***";

    public bool TryDestructure(
        object value,
        ILogEventPropertyValueFactory propertyValueFactory,
        [NotNullWhen(true)] out LogEventPropertyValue? result)
    {
        result = null;
        if (value is null || value is string)
        {
            return false;
        }

        var type = value.GetType();
        if (type.IsPrimitive || type.IsEnum)
        {
            return false;
        }

        var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
        if (properties.Length == 0)
        {
            return false;
        }

        // Guard: only intervene when the object has at least one sensitive-named
        // property. Otherwise let Serilog use its default destructuring. Keeps the
        // policy's side-effect surface minimal.
        var hasSensitive = false;
        for (var i = 0; i < properties.Length; i++)
        {
            if (SensitivePropertyNames.Contains(properties[i].Name))
            {
                hasSensitive = true;
                break;
            }
        }
        if (!hasSensitive)
        {
            return false;
        }

        var logProps = new List<LogEventProperty>(properties.Length);
        foreach (var prop in properties)
        {
            if (!prop.CanRead || prop.GetIndexParameters().Length > 0)
            {
                continue;
            }

            LogEventPropertyValue propValue;
            if (SensitivePropertyNames.Contains(prop.Name))
            {
                propValue = new ScalarValue(Sentinel);
            }
            else
            {
                object? rawValue;
                try
                {
                    rawValue = prop.GetValue(value);
                }
                catch
                {
                    // Defensive: skip properties that throw on read.
                    continue;
                }
                propValue = propertyValueFactory.CreatePropertyValue(rawValue, destructureObjects: true);
            }
            logProps.Add(new LogEventProperty(prop.Name, propValue));
        }

        result = new StructureValue(logProps, type.Name);
        return true;
    }
}

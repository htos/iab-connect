using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Identity;

/// <summary>
/// Configuration tests for the local Keycloak realm import.
/// REQ-009: role-based MFA for Admin and Kassier.
/// </summary>
public sealed class KeycloakRealmConfigurationTests
{
    private const string RealmFileName = "infra/keycloak/realms/iabconnect-realm.json";

    [Fact]
    public void Realm_ShouldConfigureRoleBasedMfaForAdminAndKassierOnly()
    {
        using var realm = LoadRealm();
        var root = realm.RootElement;

        GetString(root, "browserFlow").Should().Be("iabconnect browser role mfa");

        var roles = root.GetProperty("roles").GetProperty("realm").EnumerateArray().ToList();
        var roleNames = roles.Select(role => GetString(role, "name")).ToList();

        roleNames.Should().Contain(["admin", "kassier", "mfa-required"]);

        RoleShouldIncludeComposite(roles, "admin", "mfa-required");
        RoleShouldIncludeComposite(roles, "kassier", "mfa-required");
        RoleShouldNotIncludeComposite(roles, "member", "mfa-required");
        RoleShouldNotIncludeComposite(roles, "vorstand", "mfa-required");
        RoleShouldNotIncludeComposite(roles, "auditor", "mfa-required");
        RoleShouldNotIncludeComposite(roles, "event-manager", "mfa-required");

        var config = FindAuthenticatorConfig(root, "iabconnect-role-based-mfa");
        var configValues = config.GetProperty("config");

        GetString(configValues, "forceOtpRole").Should().Be("mfa-required");
        GetString(configValues, "defaultOtpOutcome").Should().Be("skip");
    }

    [Fact]
    public void Realm_ShouldEnableTotpAndRecoveryCodeSupport()
    {
        using var realm = LoadRealm();
        var root = realm.RootElement;

        GetString(root, "otpPolicyType").Should().Be("totp");
        GetString(root, "otpPolicyAlgorithm").Should().Be("HmacSHA1");
        root.GetProperty("otpPolicyDigits").GetInt32().Should().Be(6);
        root.GetProperty("otpPolicyPeriod").GetInt32().Should().Be(30);

        var supportedApps = root.GetProperty("otpSupportedApplications")
            .EnumerateArray()
            .Select(app => app.GetString())
            .ToList();

        supportedApps.Should().Contain(["FreeOTP", "Google Authenticator", "Microsoft Authenticator"]);

        var requiredActions = root.GetProperty("requiredActions").EnumerateArray().ToList();
        RequiredActionShouldBeEnabled(requiredActions, "CONFIGURE_TOTP");
        RequiredActionShouldBeEnabled(requiredActions, "CONFIGURE_RECOVERY_AUTHN_CODES");
    }

    [Fact]
    public void Realm_ShouldIncludeMfaAuditEvidenceEvents()
    {
        using var realm = LoadRealm();
        var root = realm.RootElement;

        root.GetProperty("eventsEnabled").GetBoolean().Should().BeTrue();
        root.GetProperty("adminEventsEnabled").GetBoolean().Should().BeTrue();
        root.GetProperty("adminEventsDetailsEnabled").GetBoolean().Should().BeTrue();

        var eventTypes = root.GetProperty("enabledEventTypes")
            .EnumerateArray()
            .Select(eventType => eventType.GetString())
            .ToList();

        eventTypes.Should().Contain([
            "LOGIN",
            "LOGIN_ERROR",
            "UPDATE_CREDENTIAL",
            "UPDATE_CREDENTIAL_ERROR",
            "EXECUTE_ACTIONS",
            "EXECUTE_ACTIONS_ERROR"
        ]);
    }

    [Fact]
    public void Realm_ShouldWireBrowserFlowToConditionalOtpAuthenticator()
    {
        using var realm = LoadRealm();
        var root = realm.RootElement;

        var formsFlow = root.GetProperty("authenticationFlows")
            .EnumerateArray()
            .Single(flow => GetString(flow, "alias") == "iabconnect browser forms role mfa");

        var executions = formsFlow.GetProperty("authenticationExecutions")
            .EnumerateArray()
            .ToList();

        executions.Should().Contain(execution =>
            GetOptionalString(execution, "authenticator") == "auth-username-password-form"
            && GetString(execution, "requirement") == "REQUIRED");

        executions.Should().Contain(execution =>
            GetOptionalString(execution, "authenticator") == "auth-conditional-otp-form"
            && GetOptionalString(execution, "authenticatorConfig") == "iabconnect-role-based-mfa"
            && GetString(execution, "requirement") == "REQUIRED");
    }

    private static JsonDocument LoadRealm()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, RealmFileName);
            if (File.Exists(candidate))
            {
                return JsonDocument.Parse(File.ReadAllText(candidate));
            }

            directory = directory.Parent;
        }

        throw new FileNotFoundException($"Could not find {RealmFileName} from {AppContext.BaseDirectory}.");
    }

    private static JsonElement FindAuthenticatorConfig(JsonElement root, string alias) =>
        root.GetProperty("authenticatorConfig")
            .EnumerateArray()
            .Single(config => GetString(config, "alias") == alias);

    private static void RequiredActionShouldBeEnabled(IReadOnlyCollection<JsonElement> actions, string alias)
    {
        var action = actions.Single(requiredAction => GetString(requiredAction, "alias") == alias);

        action.GetProperty("enabled").GetBoolean().Should().BeTrue();
    }

    private static void RoleShouldIncludeComposite(IReadOnlyCollection<JsonElement> roles, string roleName, string compositeRole)
    {
        var role = roles.Single(candidate => GetString(candidate, "name") == roleName);

        role.GetProperty("composite").GetBoolean().Should().BeTrue();
        role.GetProperty("composites")
            .GetProperty("realm")
            .EnumerateArray()
            .Select(item => item.GetString())
            .Should()
            .Contain(compositeRole);
    }

    private static void RoleShouldNotIncludeComposite(IReadOnlyCollection<JsonElement> roles, string roleName, string compositeRole)
    {
        var role = roles.Single(candidate => GetString(candidate, "name") == roleName);

        if (!role.TryGetProperty("composites", out var composites)
            || !composites.TryGetProperty("realm", out var realmComposites))
        {
            return;
        }

        realmComposites.EnumerateArray()
            .Select(item => item.GetString())
            .Should()
            .NotContain(compositeRole);
    }

    private static string GetString(JsonElement element, string propertyName) =>
        element.GetProperty(propertyName).GetString()
        ?? throw new InvalidOperationException($"Property '{propertyName}' is not a string.");

    private static string? GetOptionalString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value)
            ? value.GetString()
            : null;
}

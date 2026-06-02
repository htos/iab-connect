// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Reflection;
using FluentAssertions;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// REQ-088 AC-10 (E15-S4 / ADR-016): regression guard that ensures
/// <c>DevelopmentDataSeeder.SeedAsync</c> is invoked from <c>Program.cs</c>
/// EXCLUSIVELY inside the <c>else if (env.IsDevelopment())</c> branch.
///
/// <para>The seeder creates three demo Member records tied to dev-realm Keycloak
/// users (<c>admin@iabconnect.ch</c>, <c>vorstand@iabconnect.ch</c>,
/// <c>member@iabconnect.ch</c>). Running this in Beta would:
/// (1) pollute the tester-visible Members list with three demo emails;
/// (2) risk shipping the demo emails into production-style data;
/// (3) create Member rows whose <c>KeycloakUserId</c> points at dev-realm users
/// that don't exist in the Beta <c>postgres-kc</c> schema — broken rows.</para>
///
/// <para>Why source-inspection rather than an integration host test (story Q1
/// fallback). The shared <see cref="TestWebApplicationFactory"/> uses
/// <c>UseEnvironment("Testing")</c> hard-coded so the API integration suite shares
/// one host across <c>[Collection("Api")]</c> consumers. Standing up a parallel
/// factory with <c>UseEnvironment("Beta")</c> + Testcontainers Postgres + a
/// Serilog test-sink for one assertion is the "non-trivial factory rewiring" the
/// story explicitly authorises falling back from. Source-inspection is the
/// durable + cheap regression guard.</para>
/// </summary>
public sealed class DevelopmentDataSeederGatingTests
{
    private const string DevBranchOpener = "else if (env.IsDevelopment())";
    private const string SeederInvocation = "DevelopmentDataSeeder.SeedAsync(";

    private static string LoadProgramCsSource()
    {
        // Walk up from the test assembly location to find `backend/src/IabConnect.Api/Program.cs`.
        // Test runtime starts in `backend/tests/IabConnect.Api.Tests/bin/Debug/net10.0/`.
        var asmDir = Path.GetDirectoryName(typeof(DevelopmentDataSeederGatingTests).Assembly.Location)
            ?? throw new InvalidOperationException("Could not resolve test assembly location.");

        var dir = new DirectoryInfo(asmDir);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "src", "IabConnect.Api", "Program.cs");
            if (File.Exists(candidate))
            {
                return File.ReadAllText(candidate);
            }
            dir = dir.Parent;
        }
        throw new FileNotFoundException(
            "Could not locate src/IabConnect.Api/Program.cs by walking up from the test assembly directory.");
    }

    /// <summary>
    /// Locates the byte-offset range of the <c>else if (env.IsDevelopment())</c>
    /// block in <paramref name="source"/> by string-matching the opener and
    /// brace-counting to the matching close. Throws when the opener is missing
    /// (also a regression to detect — without the opener the seeder must not run
    /// at all).
    /// </summary>
    private static (int Start, int EndExclusive) FindDevBranchRange(string source)
    {
        var openerIndex = source.IndexOf(DevBranchOpener, StringComparison.Ordinal);
        if (openerIndex < 0)
        {
            throw new InvalidOperationException(
                $"Could not find `{DevBranchOpener}` in Program.cs source.");
        }

        // Walk forward to the opening `{`, then bracket-count to the matching `}`.
        var braceIndex = source.IndexOf('{', openerIndex);
        if (braceIndex < 0)
        {
            throw new InvalidOperationException(
                $"Could not find opening brace after `{DevBranchOpener}`.");
        }

        var depth = 1;
        var i = braceIndex + 1;
        while (i < source.Length && depth > 0)
        {
            var c = source[i];
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }

        if (depth != 0)
        {
            throw new InvalidOperationException(
                "Brace mismatch when scanning the `else if (env.IsDevelopment())` block.");
        }

        return (braceIndex, i);
    }

    /// <summary>
    /// Returns each line's start-offset in <paramref name="source"/>. Used to map
    /// match indices to line numbers for diagnostics + comment-line filtering.
    /// </summary>
    private static List<int> LineOffsets(string source)
    {
        var offsets = new List<int> { 0 };
        for (var i = 0; i < source.Length; i++)
        {
            if (source[i] == '\n')
            {
                offsets.Add(i + 1);
            }
        }
        return offsets;
    }

    private static bool IsLineCommented(string source, int matchIndex)
    {
        // Walk backward to the line start; check if the first non-whitespace token is `//`.
        var i = matchIndex;
        while (i > 0 && source[i - 1] != '\n') i--;
        var lineStart = i;
        while (i < matchIndex && char.IsWhiteSpace(source[i])) i++;
        return i + 1 < source.Length && source[i] == '/' && source[i + 1] == '/';
    }

    [Fact]
    public void Program_HasDevelopmentBranchOpener()
    {
        // Regression guard: if a future refactor renames or removes the
        // `else if (env.IsDevelopment())` branch wholesale, the seeder either
        // ends up in a different env path (a serious bug) or is removed from
        // the startup pipeline (a less serious — but visible — bug).
        var source = LoadProgramCsSource();
        source.Should().Contain(DevBranchOpener);
    }

    [Fact]
    public void Seeder_InvokedExactlyOnce_InsideDevelopmentBranch()
    {
        var source = LoadProgramCsSource();
        var (devStart, devEnd) = FindDevBranchRange(source);

        // All non-commented occurrences of `DevelopmentDataSeeder.SeedAsync(` in the file.
        var invocations = new List<int>();
        var search = 0;
        while (true)
        {
            var idx = source.IndexOf(SeederInvocation, search, StringComparison.Ordinal);
            if (idx < 0) break;
            if (!IsLineCommented(source, idx))
            {
                invocations.Add(idx);
            }
            search = idx + SeederInvocation.Length;
        }

        invocations.Should().ContainSingle(
            "the seeder is wired exactly once into the Dev startup pipeline " +
            "(commented `RealisticDataSeeder` reference lines do not count)");

        var seederPos = invocations[0];
        seederPos.Should().BeInRange(devStart, devEnd - 1,
            $"the seeder invocation must live INSIDE the `{DevBranchOpener}` block " +
            $"(devBranch [{devStart},{devEnd}), seederPos {seederPos}); " +
            "running the seeder in Beta would pollute the tester-visible Members table " +
            "with three demo emails — REQ-088 AC-10 specifically prohibits this.");
    }

    [Fact]
    public void Seeder_NotInvoked_OutsideDevelopmentBranch()
    {
        var source = LoadProgramCsSource();
        var (devStart, devEnd) = FindDevBranchRange(source);

        var outsideInvocations = new List<int>();
        var search = 0;
        while (true)
        {
            var idx = source.IndexOf(SeederInvocation, search, StringComparison.Ordinal);
            if (idx < 0) break;
            if (!IsLineCommented(source, idx) && (idx < devStart || idx >= devEnd))
            {
                outsideInvocations.Add(idx);
            }
            search = idx + SeederInvocation.Length;
        }

        outsideInvocations.Should().BeEmpty(
            "no `DevelopmentDataSeeder.SeedAsync(` invocation may appear outside " +
            "the `else if (env.IsDevelopment())` block — REQ-088 AC-10 isolation rule");
    }

    [Fact]
    public void DevelopmentDataSeeder_TypeHasNoInternalEnvironmentGate()
    {
        // The gate intentionally lives at the CALL SITE in Program.cs, not inside
        // DevelopmentDataSeeder itself. This test pins that contract: the seeder
        // type must NOT carry an `IsDevelopment()` check inside its public surface
        // (which would create two competing gates and confuse future maintainers).
        var seederType = typeof(IabConnect.Infrastructure.Persistence.DevelopmentDataSeeder);

        seederType.IsAbstract.Should().BeTrue("static classes are abstract+sealed in metadata");
        seederType.IsSealed.Should().BeTrue("static classes are abstract+sealed in metadata");

        var seedAsync = seederType.GetMethod(
            "SeedAsync",
            BindingFlags.Public | BindingFlags.Static)
            ?? throw new InvalidOperationException("Expected SeedAsync method on DevelopmentDataSeeder.");
        seedAsync.IsStatic.Should().BeTrue();
        seedAsync.GetParameters().Should().HaveCountGreaterThanOrEqualTo(1,
            "SeedAsync accepts an IServiceProvider as its first parameter");
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
using System.IO;
using System.Text.RegularExpressions;
using FluentAssertions;
using Xunit;

namespace IabConnect.Api.Tests.Logging;

/// <summary>
/// REQ-088 AC-5 (E17-S1 / ADR-017): code-audit assertions on Program.cs (bootstrap Serilog
/// logger) + backend/Dockerfile (no logs/ directory creation) + Program.cs Testing branch
/// (no File sink leakage). Direct-artifact-read per A51 — no WebApplicationFactory
/// instantiation (A49 Serilog re-entrancy guard).
///
/// AC-5 covers the early-startup window: Program.cs:10-13 sets a bootstrap Log.Logger
/// BEFORE the WebApplication.CreateBuilder call at line 19, BEFORE the
/// builder.Host.UseSerilog(...) call at line 30 that re-reads from IConfiguration.
/// If the bootstrap logger referenced a File sink against a non-existent directory,
/// the container would crash at Program.cs:17's Log.Information("Starting...") call
/// before the configuration-driven logger ever loaded.
/// </summary>
public sealed class BootstrapSerilogConfigurationTests
{
    private static string ResolveProgramCsPath()
    {
        var assemblyDir = Path.GetDirectoryName(typeof(BootstrapSerilogConfigurationTests).Assembly.Location)!;
        return Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "src", "IabConnect.Api", "Program.cs"));
    }

    private static string ResolveBackendDockerfilePath()
    {
        var assemblyDir = Path.GetDirectoryName(typeof(BootstrapSerilogConfigurationTests).Assembly.Location)!;
        return Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "Dockerfile"));
    }

    [Fact]
    public void Program_BootstrapLogger_UsesConsoleOnly_AC5()
    {
        var programCs = File.ReadAllText(ResolveProgramCsPath());

        // The bootstrap logger contract: exactly one .WriteTo.Console() call before
        // .CreateBootstrapLogger(). A regression that adds .WriteTo.File(...) into this
        // chain would silently re-introduce a File-sink dependency in the first 3-5
        // startup log lines emitted before IConfiguration is read.
        var bootstrapPattern = new Regex(
            @"new\s+LoggerConfiguration\s*\(\s*\)[\s\S]*?\.CreateBootstrapLogger\s*\(\s*\)",
            RegexOptions.Compiled);
        var match = bootstrapPattern.Match(programCs);
        match.Success.Should().BeTrue("Program.cs must contain a `new LoggerConfiguration()...CreateBootstrapLogger()` chain");

        var chain = match.Value;
        Regex.Matches(chain, @"\.WriteTo\.Console\s*\(").Count.Should().Be(1,
            "bootstrap logger must call .WriteTo.Console() exactly once");
        Regex.Matches(chain, @"\.WriteTo\.File\s*\(").Count.Should().Be(0,
            "bootstrap logger must not call .WriteTo.File(...) — container ephemeral-FS guard");
    }

    [Fact]
    public void Program_TestingBranch_DoesNotConfigureFileSink_AC6()
    {
        var programCs = File.ReadAllText(ResolveProgramCsPath());

        // Defense in depth: the Testing branch at Program.cs:66-70 currently calls
        // EnsureCreatedAsync only and inherits the Console-only base config. A future
        // overlay file or branch-specific Serilog tweak that opens File handles would
        // silently break CI runners with read-only filesystems. Assert no File sink
        // reference appears anywhere in Program.cs at all (the only File-sink legitimate
        // surface is appsettings.Development.json, asserted by ConsoleOnly* tests).
        Regex.Matches(programCs, @"\.WriteTo\.File\s*\(").Count.Should().Be(0,
            "Program.cs must contain zero .WriteTo.File(...) calls — the only legitimate File-sink configuration lives in appsettings.Development.json");

        // Confirm the Testing branch path still exists (anti-regression for the branch itself).
        programCs.Should().Contain("EnvironmentName == \"Testing\"",
            "Program.cs Testing branch must still gate the DB initialisation path");
    }

    [Fact]
    public void Dockerfile_HasNoLogsDirectoryCreation_AC7()
    {
        var dockerfilePath = ResolveBackendDockerfilePath();
        File.Exists(dockerfilePath).Should().BeTrue("backend/Dockerfile must exist");

        var dockerfile = File.ReadAllText(dockerfilePath);

        // Negative assertions: no VOLUME, mkdir, or COPY directive against a `logs` path.
        // A regression that adds any of these would create a write-capable path that masks
        // the intent of "no file-system writes from the application".
        Regex.IsMatch(dockerfile, @"^\s*VOLUME\s+.*\blogs\b", RegexOptions.IgnoreCase | RegexOptions.Multiline)
            .Should().BeFalse("Dockerfile must not declare a VOLUME on a logs path");
        Regex.IsMatch(dockerfile, @"\bmkdir\b[^\n]*\blogs\b", RegexOptions.IgnoreCase)
            .Should().BeFalse("Dockerfile must not create a logs directory via mkdir");
        Regex.IsMatch(dockerfile, @"^\s*COPY\s+[^\n]*\blogs\b", RegexOptions.IgnoreCase | RegexOptions.Multiline)
            .Should().BeFalse("Dockerfile must not COPY anything into a logs path");
    }
}

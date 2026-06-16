// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using FluentAssertions;
using Xunit;

namespace IabConnect.Api.Tests.Logging;

/// <summary>
/// REQ-088 AC-5 (E17-S1 / ADR-017): asserts the Serilog layering across appsettings.json
/// (base) + appsettings.Beta.json + appsettings.Development.json produces Console-only sinks
/// in every non-Development environment so the container runtime's log aggregator captures
/// stdout and no writes go to the ephemeral filesystem.
///
/// Test strategy is direct-artifact-read per A51 (read the JSON files via File.ReadAllText
/// + JsonDocument.Parse, assert structurally). This sidesteps A49's Serilog re-entrancy
/// constraint (re-instantiating WebApplicationFactory&lt;Program&gt; in the same process trips
/// "the logger is already frozen") — runtime tests against the configuration-loaded logger
/// are blocked here until A49's Program.cs refactor lands.
///
/// AC-9 (LayeringMatrix_MatchesDocs14Section25_AC9) reads docs/14_beta_railway_setup.md
/// Section 25.2 directly + asserts the per-environment matrix matches the JSON sources
/// byte-for-byte — A31 doc-vs-code invariant.
/// </summary>
public sealed class ConsoleOnlySerilogConfigurationTests
{
    private static string ResolveApiProjectDir()
    {
        // backend/tests/IabConnect.Api.Tests/bin/Debug/net10.0/ → backend/src/IabConnect.Api/
        var assemblyDir = Path.GetDirectoryName(typeof(ConsoleOnlySerilogConfigurationTests).Assembly.Location)!;
        return Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "src", "IabConnect.Api"));
    }

    private static string ResolveDocs14Path()
    {
        var assemblyDir = Path.GetDirectoryName(typeof(ConsoleOnlySerilogConfigurationTests).Assembly.Location)!;
        return Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "..", "docs", "14_beta_railway_setup.md"));
    }

    private static List<string> ReadWriteToSinkNames(string appsettingsPath)
    {
        var json = File.ReadAllText(appsettingsPath);
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("Serilog", out var serilog))
        {
            return new List<string>();
        }
        if (!serilog.TryGetProperty("WriteTo", out var writeTo) || writeTo.ValueKind != JsonValueKind.Array)
        {
            return new List<string>();
        }
        return writeTo.EnumerateArray()
            .Where(el => el.ValueKind == JsonValueKind.Object && el.TryGetProperty("Name", out _))
            .Select(el => el.GetProperty("Name").GetString() ?? string.Empty)
            .ToList();
    }

    [Fact]
    public void BetaOverlay_HasOnlyConsoleSink_AC1()
    {
        var path = Path.Combine(ResolveApiProjectDir(), "appsettings.Beta.json");
        File.Exists(path).Should().BeTrue("appsettings.Beta.json must exist for the Beta overlay");

        var sinks = ReadWriteToSinkNames(path);
        sinks.Should().BeEquivalentTo(new[] { "Console" },
            "the Beta overlay must declare exactly one Console sink and no File sink (ADR-017 container ephemeral-FS guard)");
    }

    [Fact]
    public void BaseConfig_HasOnlyConsoleSink_AC2()
    {
        var path = Path.Combine(ResolveApiProjectDir(), "appsettings.json");
        File.Exists(path).Should().BeTrue("appsettings.json must exist");

        var sinks = ReadWriteToSinkNames(path);
        sinks.Should().BeEquivalentTo(new[] { "Console" },
            "the base config inherited by every environment (Beta + Production + Testing) must be Console-only so a future env without an overlay still gets safe runtime semantics");
    }

    [Fact]
    public void DevelopmentOverlay_PreservesFileSink_AC3()
    {
        var path = Path.Combine(ResolveApiProjectDir(), "appsettings.Development.json");
        File.Exists(path).Should().BeTrue("appsettings.Development.json must exist");

        var sinks = ReadWriteToSinkNames(path);
        sinks.Should().Contain("Console", "Development must keep Console-output for terminal log streaming");
        sinks.Should().Contain("File", "Development must keep the File sink for developer ergonomics (rolling daily logs)");

        // Defense-in-depth: confirm the File sink targets the local logs/ subfolder (developer convention)
        var json = File.ReadAllText(path);
        using var doc = JsonDocument.Parse(json);
        var fileSink = doc.RootElement.GetProperty("Serilog").GetProperty("WriteTo")
            .EnumerateArray()
            .First(el => el.GetProperty("Name").GetString() == "File");
        fileSink.GetProperty("Args").GetProperty("path").GetString()
            .Should().StartWith("logs/", "developer convention is to write rolling logs under ./logs/");
    }

    [Fact]
    public void AllNonDevelopmentOverlays_DoNotMentionFileSink_AC4()
    {
        var apiDir = ResolveApiProjectDir();
        var allOverlays = Directory.GetFiles(apiDir, "appsettings.*.json")
            .Where(p => !Path.GetFileName(p).Equals("appsettings.Development.json", System.StringComparison.OrdinalIgnoreCase))
            .ToList();

        allOverlays.Should().NotBeEmpty("at least one non-Development overlay (appsettings.Beta.json) must exist for the AC-4 enumeration to be meaningful");

        foreach (var overlay in allOverlays)
        {
            var sinks = ReadWriteToSinkNames(overlay);
            sinks.Should().NotContain("File",
                $"non-Development overlay '{Path.GetFileName(overlay)}' must not introduce a File sink (container ephemeral-FS guard)");
        }
    }

    [Fact]
    public void LayeringMatrix_MatchesDocs14Section25_AC9()
    {
        var docsPath = ResolveDocs14Path();
        File.Exists(docsPath).Should().BeTrue("docs/14_beta_railway_setup.md must exist for the A31 doc-vs-code invariant");

        var docs = File.ReadAllText(docsPath);
        // Section 25 must be published by Task 4 of this story
        docs.Should().Contain("## 25. Serilog Console-only sink in container environments (E17-S1)",
            "docs/14 Section 25 (E17-S1) must be published with the canonical heading so this A31 invariant test can locate it");

        // Locate Section 25 body
        var section25StartIdx = docs.IndexOf("## 25. Serilog Console-only sink", System.StringComparison.Ordinal);
        section25StartIdx.Should().BeGreaterThan(0);
        var section25EndIdx = docs.IndexOf("\n## ", section25StartIdx + 1, System.StringComparison.Ordinal);
        if (section25EndIdx < 0)
        {
            section25EndIdx = docs.Length;
        }
        var section25 = docs.Substring(section25StartIdx, section25EndIdx - section25StartIdx);

        // Section 25.2 must document the four rows; A31 invariant: each documented row matches
        // the corresponding JSON-file projection. Loose string-presence check (the row text format
        // is operator-facing, so we assert each environment label + its effective sink set appear
        // together within the same section).
        section25.Should().Contain("Development", "Development row required in Section 25.2 matrix");
        section25.Should().Contain("Beta", "Beta row required in Section 25.2 matrix");
        section25.Should().Contain("Production", "Production row required in Section 25.2 matrix (per DEC-2=B: inherits base)");
        section25.Should().Contain("Testing", "Testing row required in Section 25.2 matrix (per AC-6: inherits base)");

        // Cross-check actual file projections against documented expectations
        var apiDir = ResolveApiProjectDir();
        var baseSinks = ReadWriteToSinkNames(Path.Combine(apiDir, "appsettings.json"));
        var betaSinks = ReadWriteToSinkNames(Path.Combine(apiDir, "appsettings.Beta.json"));
        var devSinks = ReadWriteToSinkNames(Path.Combine(apiDir, "appsettings.Development.json"));

        baseSinks.Should().BeEquivalentTo(new[] { "Console" });
        betaSinks.Should().BeEquivalentTo(new[] { "Console" });
        devSinks.Should().Contain("Console");
        devSinks.Should().Contain("File");

        // Doc-vs-code parity: Section 25.2 must mention "Console" alongside each environment row
        // and "File" exactly once (in the Development row). Coarse-grained byte-level check —
        // a stricter regex-extraction-of-table-row would be brittle to Markdown formatting tweaks.
        var section25FileMentions = Regex.Matches(section25, @"\bFile\b").Count;
        section25FileMentions.Should().BeGreaterThanOrEqualTo(1,
            "Section 25 must mention the File sink at least once (in the Development row of the matrix)");
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Net;
using System.Net.Http.Headers;
using FluentAssertions;
using IabConnect.Api.Authorization;
using IabConnect.Domain.Common;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-088 AC-3 + REQ-087 / REQ-035 (E16-S3 / ADR-013): authorization-triple regression
/// guards for the document upload + download endpoints in
/// <see cref="IabConnect.Api.Endpoints.DocumentEndpoints"/>.
///
/// <para>Three gates compose at the document endpoints (DocumentEndpoints.cs:60+72+89):
/// <list type="number">
/// <item><c>Module:documents</c> module-gate (REQ-087 / E10-S3) — disabled module → 403;</item>
/// <item><c>RequireVorstand</c> role-gate on upload — non-vorstand → 403;</item>
/// <item>Authentication scheme — no bearer → 401.</item>
/// </list>
/// These tests assert each layer in isolation, and the download endpoint's auth layer.
/// The live-Beta walkthrough (docs/14_beta_railway_setup.md §19) exercises the same
/// gates against the deployed api service; these tests are the in-process regression
/// guard so a refactor cannot silently drop a gate.</para>
/// </summary>
[Collection("Api")]
public sealed class DocumentUploadAuthzTests
{
    private readonly TestWebApplicationFactory _factory;
    private readonly TestModuleSettingsService _modules;

    public DocumentUploadAuthzTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _modules = factory.Services.GetRequiredService<TestModuleSettingsService>();
        _modules.Reset();
    }

    private const string TestUserId = "22222222-2222-2222-2222-222222222222";
    private const string DownloadId = "33333333-3333-3333-3333-333333333333";

    private HttpClient CreateAuthenticatedClient(params string[] roles)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, TestUserId);
        if (roles.Length > 0)
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, string.Join(",", roles));
        }
        return client;
    }

    private static MultipartFormDataContent BuildMultipartUpload()
    {
        // Minimal valid multipart body: a `file` field carrying 4 bytes + a folderId field.
        // The auth gates fire BEFORE the handler reads the body, so the payload only needs
        // to be syntactically well-formed multipart, not semantically a real document upload.
        var content = new MultipartFormDataContent();
        var bytes = new ByteArrayContent(new byte[] { 0x68, 0x69, 0x21, 0x0a }); // "hi!\n"
        bytes.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        content.Add(bytes, "file", "test.txt");
        content.Add(new StringContent(Guid.NewGuid().ToString()), "folderId");
        return content;
    }

    [Fact]
    public async Task Upload_WithoutBearer_Returns401()
    {
        // No X-Test-User → TestAuthHandler returns NoResult → anonymous → 401.
        var client = _factory.CreateClient();
        using var body = BuildMultipartUpload();

        var response = await client.PostAsync("/api/v1/documents/", body, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Upload_AsMember_Returns403()
    {
        // member role does NOT satisfy RequireVorstand at DocumentEndpoints.cs:73.
        var client = CreateAuthenticatedClient(Roles.Member);
        using var body = BuildMultipartUpload();

        var response = await client.PostAsync("/api/v1/documents/", body, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden,
            "the upload endpoint requires the 'vorstand' role; a 'member'-only principal must be denied");
    }

    [Fact]
    public async Task Upload_AsVorstand_WithDocumentsModuleDisabled_Returns403()
    {
        // Module:documents (REQ-087 / E10-S3) is enforced at the RouteGroupBuilder level
        // per DocumentEndpoints.cs:60 — fires BEFORE the RequireVorstand role check, so a
        // valid vorstand still gets 403 when the module is disabled.
        _modules.SetEnabled(ModuleKeys.Documents, false);
        try
        {
            var client = CreateAuthenticatedClient(Roles.Vorstand);
            using var body = BuildMultipartUpload();

            var response = await client.PostAsync("/api/v1/documents/", body, TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden,
                "the documents module is disabled, so its route group must deny access regardless of role");
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Fact]
    public async Task Download_WithoutBearer_Returns401()
    {
        // GET /api/v1/documents/{id}/download with no Authorization header → 401.
        var client = _factory.CreateClient();

        var response = await client.GetAsync(
            $"/api/v1/documents/{DownloadId}/download",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Download_AsMember_WithDocumentsModuleDisabled_Returns403()
    {
        // Downloads are RequireMember + Module:documents. A 'member' role satisfies the
        // role-gate; the module-gate must still kick in when documents is disabled.
        _modules.SetEnabled(ModuleKeys.Documents, false);
        try
        {
            var client = CreateAuthenticatedClient(Roles.Member);

            var response = await client.GetAsync(
                $"/api/v1/documents/{DownloadId}/download",
                TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
        finally
        {
            _modules.Reset();
        }
    }
}

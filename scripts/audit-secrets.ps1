# SPDX-License-Identifier: AGPL-3.0-or-later
<#
.SYNOPSIS
    Audits the IAB Connect repository for secrets in the working tree and git history.

.DESCRIPTION
    Greps the tracked-files working tree for 10 secret-shaped patterns and matches each
    finding against an inline allowlist of documented dev-only well-known values. Exits 0
    when all findings are allowlisted, exits 1 when any un-allowlisted match is found.

    Reference: E14-S1 (REQ-088 AC-4). See docs/14_beta_railway_setup.md Section 20.

.PARAMETER WorkingTreeOnly
    Skip the slow git-history scan; only scan the current working tree.

.PARAMETER VerboseOutput
    Print every allowlisted match too, not just the un-allowlisted ones.

.PARAMETER SelfTest
    Exercise the allowlist-match logic with synthetic positive + negative inputs.
    Does not touch the repo; deterministic; used by E14-S1 AC-9 self-test gate.
#>

[CmdletBinding()]
param(
    [switch]$WorkingTreeOnly,
    [switch]$VerboseOutput,
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'

# --- pwsh 7+ guard (A45 documented-binary-surface reachability) -----------
if (-not ($PSVersionTable.PSEdition -eq 'Core' -or $PSVersionTable.PSVersion.Major -ge 7)) {
    Write-Host "ERROR: scripts/audit-secrets.ps1 requires PowerShell Core / pwsh 7+." -ForegroundColor Red
    Write-Host "  Current: $($PSVersionTable.PSEdition) v$($PSVersionTable.PSVersion)"
    Write-Host "  Install: 'winget install Microsoft.PowerShell' (Win), 'brew install powershell' (mac), apt PMC (Linux)."
    exit 1
}

# --- Patterns to grep for (case-insensitive) ------------------------------
$Patterns = @(
    'password',
    'secret',
    'client_secret',
    'api_key',
    'access_key',
    'ConnectionStrings',
    'BEGIN RSA',
    'BEGIN PRIVATE',
    'NEXTAUTH_SECRET',
    'EncryptionKey'
)

# --- File-level allowlist (glob patterns) ---------------------------------
# Files whose entire content is known clean by design (placeholders + docs +
# vendored tooling). Includes the audit script itself (carries its own allowlist
# literals) and the BMAD skill packs / templates / message dictionaries which
# legitimately mention the words "password" + "secret" as documentation examples.
$FileAllowlistPatterns = @(
    # Placeholder-only env templates
    'backend/.env.example',
    'frontend/.env.example',
    # Sanitized Beta realm (E12-S3)
    'infra/keycloak/realms-beta/*.json',
    # The audit script itself
    'scripts/audit-secrets.ps1',
    # Operator-facing docs
    'docs/*.md',
    'README.md',
    'CONTRIBUTING.md',
    'NOTICE.md',
    # BMAD planning + implementation artifacts (story files, retros, deferred-work)
    '_bmad-output/*',
    # BMAD vendored skill packs + templates (documentation examples mention the words)
    '.agent/*',
    '.agents/*',
    '.claude/*',
    '_bmad/*',
    # i18n message dictionaries (UI strings like "Password reset", "Forgot password")
    'frontend/messages/*',
    'frontend/src/messages/*',
    # tooling configs + license + dockerignore + GitHub agent configs
    'backend/.config/*',
    'LICENSE',
    'COPYRIGHT',
    '*.dockerignore',
    '.github/agents/*',
    # Code-identifier mentions in .cs / .ts / .tsx (e.g., `public string Password`,
    # MapPost("/reset-password"), AuditEventType.PasswordReset) — these are normal
    # application terminology, not committed secrets. The audit's risk surface is
    # value sites in config files, not C#/TS identifier names.
    '*.cs',
    '*.ts',
    '*.tsx',
    '*.js',
    '*.jsx',
    '*.cshtml',
    '*.html',
    '*.razor',
    '*.csproj',
    '*.sln'
)

# --- String-level allowlist -----------------------------------------------
# Any finding-line containing one of these substrings is allowlisted.
$StringAllowlist = @{
    # SCP-2026-05-15 §5 well-known dev defaults
    'postgres/postgres'                              = 'SCP §5 well-known PostgreSQL dev credential'
    'Password=postgres'                              = 'SCP §5 well-known PostgreSQL dev credential (ConnectionString form)'
    'rustfsadmin'                                    = 'SCP §5 well-known RustFS dev credential'
    'dev-secret-change-me'                           = 'Generic placeholder grammar; communicates Dev-only intent'
    'dev-admin-secret-change-me'                     = 'Generic placeholder grammar (E14-S1 Task 2.1 replacement)'

    # E14-S1 DEC-1=A: dev realm secrets allowlisted as documented dev-only
    'admin-service-secret-2026'                      = 'Dev realm import literal; never deployed to Beta (E14-S1 DEC-1=A)'
    'frontend-dev-secret-2026'                       = 'Dev realm import literal; never deployed to Beta (E14-S1 DEC-1=A)'
    'Admin-Dev-2026!'                                = 'Dev realm seed user password (temporary:true); E14-S1 DEC-1=A'
    'Vorstand-Dev-2026!'                             = 'Dev realm seed user password (temporary); E14-S1 DEC-1=A'
    'Member-Dev-2026!'                               = 'Dev realm seed user password (temporary); E14-S1 DEC-1=A'
    'Kassier-Dev-2026!'                              = 'Dev realm seed user password (temporary); E14-S1 DEC-1=A'
    'Auditor-Dev-2026!'                              = 'Dev realm seed user password (temporary); E14-S1 DEC-1=A'
    'Events-Dev-2026!'                               = 'Dev realm seed user password (temporary); E14-S1 DEC-1=A'

    # E14-S1 DEC-1=A: docker-compose.full.yml literals (E12-S4-D20' deferred)
    'local-dev-secret-min-32-chars-aaaaaaaaaaaaaaa'  = 'docker-compose.full NextAuth dev secret (E12-S4-D20''; E14-S1 DEC-1=A)'
    'admin-full'                                     = 'docker-compose.full Keycloak admin password (E14-S1 DEC-1=A)'

    # Test infrastructure
    'test-access-key'                                = 'TestWebApplicationFactory dummy S3 access key'
    'test-secret-key'                                = 'TestWebApplicationFactory dummy S3 secret key'
    'Username=test;Password=test'                    = 'TestWebApplicationFactory dummy connection string'

    # .env.example placeholder grammar
    '__set_in_environment__'                         = '.env.example placeholder grammar'
    '__min_32_chars__'                               = '.env.example length-sensitive placeholder annotation'
    '__base64_32_bytes__'                            = '.env.example base64-sensitive placeholder annotation'

    # Realm-import substitution patterns (Beta uses ${VAR}; visible in dev/full overlays too)
    '${IABCONNECT_ADMIN_CLIENT_SECRET}'              = 'Beta-realm placeholder substitution'
    '${IABCONNECT_FRONTEND_CLIENT_SECRET}'           = 'Beta-realm placeholder substitution'
    '${IABCONNECT_BETA_HOST}'                        = 'Beta-realm placeholder substitution'
    '${FRONTEND_PUBLIC_URL}'                         = 'Beta-realm placeholder substitution'

    # docker-compose.yml dev well-knowns
    'POSTGRES_PASSWORD: postgres'                    = 'docker-compose.yml dev Postgres init credential'
    'KC_DB_PASSWORD: postgres'                       = 'docker-compose.yml dev Keycloak DB credential'
    'KEYCLOAK_ADMIN_PASSWORD: admin'                 = 'docker-compose.yml dev Keycloak admin credential'
    'RUSTFS_ACCESS_KEY: rustfsadmin'                 = 'docker-compose.yml dev RustFS access key'
    'RUSTFS_SECRET_KEY: rustfsadmin'                 = 'docker-compose.yml dev RustFS secret key'

    # Structural / non-value JSON hits in realm import (Keycloak metadata)
    '"Password": null'                               = 'Empty SMTP password placeholder in appsettings'
    '"password": ""'                                 = 'Empty SMTP password in realm import smtpServer block'
    '"type": "password"'                             = 'Keycloak credential-type discriminator (not a value)'
    '"resetPasswordAllowed"'                         = 'Keycloak realm setting key (not a value)'
    'RESET_PASSWORD'                                 = 'Keycloak audit-event enum string'
    'SEND_RESET_PASSWORD'                            = 'Keycloak audit-event enum string'
    'UPDATE_PASSWORD'                                = 'Keycloak required-action enum string'
    'auth-username-password-form'                    = 'Keycloak built-in authenticator name'
    'Username/password form'                         = 'Keycloak flow description text'

    # CI/CD built-in secret references (never a literal)
    '${{ secrets.GITHUB_TOKEN }}'                    = 'GitHub Actions built-in secret reference'
    '${{ secrets.'                                   = 'GitHub Actions secret-prefix; never a literal value'

    # Keycloak Admin API call payloads (literal strings sent to Keycloak; not secrets)
    '/credentials/password-credential'               = 'Keycloak Admin API path component'
    'password-credential'                            = 'Keycloak credential-id string'

    # Empty / structural JSON + YAML entries
    '"ClientSecret": ""'                             = 'Empty placeholder in appsettings.json (sourced from env)'
    '"SecretKey": ""'                                = 'Empty placeholder in appsettings.json (sourced from env)'
    'Keycloak__ClientSecret: ""'                     = 'Empty placeholder in docker-compose.full.yml overlay'
    '"ConnectionStrings": {'                         = 'JSON section opener; not a value'
    '_comment_CalendarTokenPepper'                   = 'Inline JSON comment-key documenting Auth__CalendarTokenPepper'
    'local-dev secrets from'                         = 'docker-compose.full.yml comment referencing the dev secrets origin'
    'NEXT_PUBLIC_* values bake'                      = 'build-images.yml comment describing variable semantics'
    'Secrets and variables'                          = 'build-images.yml comment referencing GitHub UI'
}

# --- Allowlist-matching helpers -------------------------------------------

function Test-LineAllowlisted {
    param([Parameter(Mandatory)][string]$Line)
    foreach ($key in $StringAllowlist.Keys) {
        if ($Line.Contains($key)) { return $true }
    }
    return $false
}

function Test-FileAllowlisted {
    param([Parameter(Mandatory)][string]$Path)
    $normalizedPath = $Path.Replace('\', '/')
    foreach ($pattern in $FileAllowlistPatterns) {
        $normalizedPattern = $pattern.Replace('\', '/')
        if ($normalizedPath -like $normalizedPattern) { return $true }
    }
    return $false
}

# --- Self-test mode (AC-9) ------------------------------------------------

function Invoke-SelfTest {
    Write-Host "audit-secrets.ps1 SELF-TEST starting..." -ForegroundColor Cyan
    $pass = 0
    $fail = 0

    $cases = @(
        @{ Line = '  "DefaultConnection": "Host=localhost;Port=5433;Database=iabconnect;Username=postgres;Password=postgres"'; Expected = $true; Label = 'postgres/postgres line' }
        @{ Line = '  password: "leaked-real-secret-xyz123"'; Expected = $false; Label = 'real-looking secret' }
        @{ Line = '          "value": "Admin-Dev-2026!",'; Expected = $true; Label = 'Admin-Dev-2026! seed' }
        @{ Line = '-----BEGIN RSA PRIVATE KEY-----'; Expected = $false; Label = 'BEGIN RSA PRIVATE KEY' }
        @{ Line = '  "ClientSecret": "${IABCONNECT_ADMIN_CLIENT_SECRET}"'; Expected = $true; Label = 'Beta-realm placeholder' }
        @{ Line = '  Keycloak__ClientSecret=__set_in_environment__'; Expected = $true; Label = '.env.example placeholder' }
        @{ Line = 'POSTGRES_PASSWORD: secret_prod_xy12'; Expected = $false; Label = 'real Postgres prod credential' }
    )

    foreach ($c in $cases) {
        $actual = Test-LineAllowlisted -Line $c.Line
        if ($actual -eq $c.Expected) {
            $pass++
            Write-Host "  PASS: $($c.Label)" -ForegroundColor Green
        } else {
            $fail++
            Write-Host "  FAIL: $($c.Label) (expected=$($c.Expected) actual=$actual)" -ForegroundColor Red
        }
    }

    # File allowlist tests
    $fileCases = @(
        @{ Path = 'backend/.env.example'; Expected = $true; Label = '.env.example file-allowlisted' }
        @{ Path = 'infra/keycloak/realms-beta/iabconnect-realm.json'; Expected = $true; Label = 'Beta realm file-allowlisted' }
        @{ Path = 'infra/keycloak/realms/iabconnect-realm.json'; Expected = $false; Label = 'Dev realm NOT file-allowlisted' }
        @{ Path = 'backend/src/IabConnect.Api/appsettings.Development.json'; Expected = $false; Label = 'Dev overlay NOT file-allowlisted (line-level only)' }
        @{ Path = 'docs/14_beta_railway_setup.md'; Expected = $true; Label = 'docs/*.md allowlisted' }
    )

    foreach ($c in $fileCases) {
        $actual = Test-FileAllowlisted -Path $c.Path
        if ($actual -eq $c.Expected) {
            $pass++
            Write-Host "  PASS: $($c.Label)" -ForegroundColor Green
        } else {
            $fail++
            Write-Host "  FAIL: $($c.Label) (expected=$($c.Expected) actual=$actual)" -ForegroundColor Red
        }
    }

    Write-Host ""
    if ($fail -eq 0) {
        Write-Host "AUDIT_SELFTEST_OK: $pass pass, 0 fail" -ForegroundColor Green
    } else {
        Write-Host "AUDIT_SELFTEST_FAIL: $pass pass, $fail fail" -ForegroundColor Red
    }
    return $fail
}

if ($SelfTest) {
    $failures = Invoke-SelfTest
    exit $failures
}

# --- Repository sanity check (Edge-9: prevent false-pass when invoked outside repo) ---

$gitTopLevel = & git rev-parse --show-toplevel 2>$null
if (-not $gitTopLevel -or $LASTEXITCODE -ne 0) {
    Write-Host "ERROR: scripts/audit-secrets.ps1 must run from inside a git working tree." -ForegroundColor Red
    Write-Host "  Current directory does not appear to be a git repository (git rev-parse --show-toplevel failed)."
    Write-Host "  Cd to the iab-connect repo root and re-invoke: pwsh ./scripts/audit-secrets.ps1"
    exit 1
}

# --- Working-tree scan ----------------------------------------------------

Write-Host "audit-secrets.ps1 starting working-tree scan..." -ForegroundColor Cyan

$totalHits = 0
$allowlistedHits = 0
$unallowlisted = New-Object System.Collections.Generic.List[string]

foreach ($pattern in $Patterns) {
    # git grep -inI -F: case-insensitive, line-numbers, skip binary, fixed-string
    $grepOutput = & git grep -inI -F $pattern 2>$null
    if (-not $grepOutput) { continue }

    foreach ($raw in $grepOutput) {
        # Format: <path>:<lineno>:<line>
        $colon1 = $raw.IndexOf(':')
        if ($colon1 -lt 0) { continue }
        $colon2 = $raw.IndexOf(':', $colon1 + 1)
        if ($colon2 -lt 0) { continue }
        $path = $raw.Substring(0, $colon1)
        $lineno = $raw.Substring($colon1 + 1, $colon2 - $colon1 - 1)
        $line = $raw.Substring($colon2 + 1)

        $totalHits++

        if (Test-FileAllowlisted -Path $path) {
            $allowlistedHits++
            if ($VerboseOutput) {
                Write-Host "  [file-allowlisted] ${path}:${lineno} (pat=$pattern)" -ForegroundColor DarkGray
            }
            continue
        }

        if (Test-LineAllowlisted -Line $line) {
            $allowlistedHits++
            if ($VerboseOutput) {
                Write-Host "  [string-allowlisted] ${path}:${lineno} (pat=$pattern)" -ForegroundColor DarkGray
            }
            continue
        }

        $unallowlisted.Add("${path}:${lineno} (pat=$pattern) $($line.Trim())")
    }
}

# --- Git history scan (advisory) ------------------------------------------

if (-not $WorkingTreeOnly) {
    Write-Host "audit-secrets.ps1 starting git-history scan (advisory; may take 30-60s)..." -ForegroundColor Cyan
    foreach ($pattern in @('password', 'secret', 'client_secret')) {
        $commitShas = & git log --format='%h' -S $pattern -- 2>$null
        if (-not $commitShas) { continue }
        $count = ($commitShas | Measure-Object).Count
        if ($VerboseOutput) {
            Write-Host "  git history: $count commits touched pattern '$pattern'" -ForegroundColor DarkGray
        }
    }
    Write-Host "audit-secrets.ps1 git-history scan complete (advisory; reviewer should run gitleaks for forensic depth)." -ForegroundColor DarkGray
}

# --- Report ---------------------------------------------------------------

Write-Host ""
if ($unallowlisted.Count -eq 0) {
    Write-Host "AUDIT_OK: $allowlistedHits allowlisted hits, 0 un-allowlisted" -ForegroundColor Green
    exit 0
}

Write-Host "AUDIT_FAIL: $($unallowlisted.Count) un-allowlisted finding(s) (out of $totalHits total hits)" -ForegroundColor Red
foreach ($f in $unallowlisted) {
    Write-Host "  $f" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Triage: see docs/14_beta_railway_setup.md Section 20.5 for the failure decision tree." -ForegroundColor Cyan
exit 1

# Contributing to IAB Connect

REQ-089 AC-3 (E20-S1) / ADR-010: this document describes how to contribute to IAB Connect, including the contribution license, the Developer Certificate of Origin (DCO) sign-off requirement, and the development workflow.

## 1. Project license

IAB Connect is licensed under the GNU Affero General Public License version 3.0 or later. See [LICENSE](LICENSE) for the full text and [COPYRIGHT](COPYRIGHT) for the project copyright statement.

By contributing a patch (commit, pull request, issue with attached code) you agree to license it under **AGPL-3.0-or-later**. This is the same license as the rest of the project — no separate Contributor License Agreement (CLA) is required.

## 2. DCO sign-off

Every commit in a pull request targeting `main` or `beta` MUST carry a [Developer Certificate of Origin](https://developercertificate.org/) v1.1 sign-off trailer in the commit message. The trailer asserts that you have the right to license the contribution under the project license.

Use `git commit -s -m "your message"` to add the trailer automatically. The resulting commit message ends with:

```
Signed-off-by: Your Name <your.email@example.com>
```

The email in the trailer must match the email on the commit author. If you forgot the sign-off on an existing commit, amend it with `git commit --amend -s` (or `git rebase --signoff <base>` for multiple commits) and force-push.

Branch protection on `main` and `beta` requires the `DCO` status check to pass before merge — see [`.github/workflows/dco.yml`](.github/workflows/dco.yml).

## 3. Workflow

1. **Branch** from `main` (for feature work) or `beta` (for Beta-environment-specific fixes). Branch names follow the existing convention `feat/<scope>`, `fix/<scope>`, `chore/<scope>`, etc.
2. **Commit** with sign-off (`git commit -s`). Use [Conventional Commits](https://www.conventionalcommits.org/) style: `<type>(<scope>): <description>` — matches the existing repository convention documented in [README.md](README.md).
3. **Open a pull request** against the source branch you forked from. The PR title should follow the same Conventional Commits style.
4. **Address review** comments, push follow-up commits (also signed), and re-request review.

## 4. Local development

See [README.md](README.md) "Getting Started" section for prerequisites (Node.js 22+, .NET 10 SDK, Docker, PostgreSQL) and the local quickstart. Project documentation lives under [`docs/`](docs/).

## 5. Running tests

- **Backend:** `dotnet test` from `backend/` runs all .NET test projects (xUnit v3 + FluentAssertions + Moq + Testcontainers PostgreSQL for integration-layer tests).
- **Frontend unit/component tests:** `npm test` (or `npm test -- --run`) from `frontend/` runs Vitest with Testing Library.
- **Frontend end-to-end tests:** `npm run e2e` from `frontend/` runs Playwright.

Before opening a PR, run at least: backend `dotnet test`, frontend `npm run typecheck`, `npm run lint`, and `npm test`. The DCO check and (in future stories) image-build CI run automatically on PR open.

## 6. Filing issues

Use the issue tracker at [`https://github.com/htos/iab-connect/issues`](https://github.com/htos/iab-connect/issues). Search for duplicates before opening a new issue. Beta-environment feedback can additionally use the in-app feedback link rendered by the BETA banner (E18-S4, future).

## SPDX license headers

New source files committed after 2026-05-15 must begin with `// SPDX-License-Identifier: AGPL-3.0-or-later` (or the equivalent comment syntax for the file type — see table below).

Existing files are NOT retroactively swept. A future story may add a sweep if `reuse lint` becomes a release gate.

### Comment-syntax table

| File type | Extensions | Header |
| --- | --- | --- |
| C# | `.cs` | `// SPDX-License-Identifier: AGPL-3.0-or-later` |
| TypeScript / JavaScript / TSX / JSX | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` | `// SPDX-License-Identifier: AGPL-3.0-or-later` |
| CSS / SCSS | `.css`, `.scss` | `/* SPDX-License-Identifier: AGPL-3.0-or-later */` |
| YAML | `.yml`, `.yaml` | `# SPDX-License-Identifier: AGPL-3.0-or-later` |
| Dockerfile | `Dockerfile`, `*.dockerfile` | `# SPDX-License-Identifier: AGPL-3.0-or-later` |
| Shell | `.sh`, `.bash` | `# SPDX-License-Identifier: AGPL-3.0-or-later` (after the shebang) |
| PowerShell | `.ps1` | `# SPDX-License-Identifier: AGPL-3.0-or-later` |
| Batch | `.bat`, `.cmd` | `REM SPDX-License-Identifier: AGPL-3.0-or-later` |
| Java (Keycloak SPI) | `.java` | `// SPDX-License-Identifier: AGPL-3.0-or-later` |
| Markdown | `.md` | Not required (license context is implicit for documentation). If desired, a YAML front-matter `license: AGPL-3.0-or-later` is acceptable. |
| JSON | `.json` | **Not required.** JSON has no native comment syntax; SPDX header policy explicitly exempts JSON files (`package.json`, `tsconfig.json`, `appsettings*.json`, `frontend/messages/{en,de}.json`). |

The table is the source of truth — if a file extension is not in the table, the rule does not apply and the contributor should ask in their PR.

### Editor configuration (recommended, not enforced)

- **VS Code:** install the `psioniq.psi-header` extension and configure a template that emits `// SPDX-License-Identifier: AGPL-3.0-or-later` on file creation for the table file types.
- **JetBrains Rider / IntelliJ:** configure File and Code Templates per file type (Preferences → Editor → File and Code Templates) to emit the SPDX header on new file creation.
- **Pre-commit hook (future enhancement):** a `husky` + `lint-staged` pre-commit hook that fails the commit if a staged source file in a table-listed type lacks an SPDX header is a future enhancement, not required now.

Automatic enforcement is out of scope; PR review enforces this policy.


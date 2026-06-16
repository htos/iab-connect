# Epic-17 Boundary Code Review — 2026-06-02

**Scope:** Epic-17 (Monitoring, Logging, and Health Checks) — three stories closed in a single autonomous-mode session per user directive: "implementiere das ganze epic 17 mit den stories. höre erst auf wenn alle stories geamcht sind und führe danach das retro aus. nicht stoppen bis es durch ist. berücksichtige dabei das es sich nicht um ein mvp handelt." (2026-06-02).

- **E17-S1** Restrict Serilog to Console in containers (8 code-audit tests + docs/14 Section 25)
- **E17-S2** Validate structured logs with CorrelationId (12 tests across CorrelationIdMiddlewareTests + RequestLoggingPipelineTests + docs/14 Section 26)
- **E17-S4** External uptime monitoring (5 code-audit tests + docs/14 Section 27)
- **E17-S3** Frontend `/api/health` endpoint — already absorbed by E13-S4 (DEC-1=A 2026-06-01).

**Review pattern:** 3-layer adversarial per project memory `feedback_bmad_workflow` hybrid CR+ER policy (skip per-story bmad-code-review; bundle review + retrospective at epic boundary).

## Hunter outputs

| Layer | Subagent prompt | Findings produced |
|---|---|---|
| Blind Hunter | Fresh-eyes operator-facing read; A42 + A45 categories (cross-section contradictions, pre-filled status, stale anchors, imprecise claims, sprint-tracking leakage, binary reachability) | 12 |
| Edge Case Hunter | Walk every branch, boundary, regex evasion in the code-audit tests; verify against the source-of-truth files | 15 |
| Acceptance Auditor | AC-vs-evidence parity walk; A29 + A30 + A31 + A41/A43 + A47 + A51 + A52 compliance audit | 12 |
| **TOTAL** | | **39** |

## Triage

| Action | Count |
|---|---|
| Patches APPLIED in-session | **14** |
| Deferred to deferred-work.md | **14** |
| Dismissed (false positive / cosmetic / scope-out) | **11** |

### Patches applied (14)

| ID | Severity | Source | Summary |
|---|---|---|---|
| P1 | High | Blind Hunter | All 3 story files had stale `Status: ready-for-dev (was: backlog)` at bottom while top said `review`. Updated bottom blocks to `Status: review` + dev-story execution note. |
| P2 | High | Blind Hunter | Pre-filled GitHub-renderable `- [ ] (Q1) ...` checkboxes in §25.6, §26.8, §27.9 converted to `- (Q1) [!] ...` per A30 three-state convention. |
| P3 | Medium | Blind Hunter | Stale anchor `#51-api-service-variables` → `#51-api-service` in §27.4.A step 6. |
| P4 | Medium | Blind Hunter | §27.1 wrongly cited `Section 23.4` for rate-limit exemption (23.4 is X-Forwarded-For trust). Changed to `Section 23` whole-section anchor. |
| P5 / E2 | Medium | Blind Hunter + Edge Case Hunter | AC-5 test's `leakDefenseBindings` dict was empty + no `AddEnvironmentVariables` chain — documented A36 protection was theatre. Patched: populated dict with all 4 expected JSON-file values AND prepended `AddEnvironmentVariables()` so the layering actually exercises the defense. |
| P8 | Low | Blind Hunter | E17-S1 refresh-note mentioned `Select-String` + `docker inspect` for §25.3 commands but the published §25.3 actually uses `Get-Content` + `ConvertFrom-Json` + `Select-Object`. Fixed refresh-note to match shipped doc. |
| P11 | Low | Blind Hunter | §27.6 subsection heading "(AC-8 placeholder)" was sprint-tracking leakage in operator-facing content. Renamed to "Monitor dashboard URL (fill in after walkthrough)". |
| P12 | Low | Blind Hunter | §27.3 "Reconciliation note" leaked SCP+DEC-2=A sprint-tracking commentary into operator doc. Replaced with operator-facing "Why not sub-5-minute detection on free tiers?" paragraph that conveys the same SLO floor reasoning without internal-process labels. |
| E1 | High | Edge Case Hunter | AC-5 test only verified `Serilog:MinimumLevel:*` keys but the parallel `Logging:LogLevel:*` tree (Microsoft.Extensions.Logging adapter surface) was unprotected. Added 3 assertions for `Logging:LogLevel:Default`, `Microsoft.AspNetCore`, `Microsoft.EntityFrameworkCore`. |
| E3 | High | Edge Case Hunter | `HealthReady_HasNoAuthorizationRequirement_AC1` used `IndexOf(");")` walker, fragile against routine refactors to the response-writer lambda. Refactored to parenthesis-balance walking + added positive `.DisableRateLimiting()` anti-regression assertion. |
| A1 | High | Acceptance Auditor | E17-S2 AC-1 Quality-Gates row credited `_AC1` test (HttpContext.Items proxy assertion only) for "LogContext push verified". Updated row to cite `_AC1 + _AC1b` together so the TestCorrelator probe is properly evidenced. |
| A6 | High | Acceptance Auditor | E17-S4 AC-9 had 4 sub-items (alert email / dashboard Down / recovery email / latency recorded) but Quality-Gates table aggregated to one row. Per A29, expanded to 4 rows AC-9(a)/(b)/(c)/(d). |
| A7 | Medium | Acceptance Auditor | E17-S4 AC-6 had 5 sub-items (account create / monitor add / interval / contact / alert rule) aggregated to one Q1+Q2 walkthrough row. Expanded to 5 rows AC-6(a)/(b)/(c)/(d)/(e); also expanded §27.9 Q2 to explicitly enumerate DEC-2=A 3-consecutive rule configuration. |
| A9 | Low | Acceptance Auditor | E17-S2 Refresh Notes claimed "A52 N/A" but AC-12 walkthrough Q-items name `/health/ready` explicitly. Updated to reference E17-S4 Task 0.1 + 0.2 verification. |
| A10 | Low | Acceptance Auditor | E17-S1 Task 5.3 marked `[ ]` (pending) while story status is `review`. Per A30 three-state convention, deferral to a future epic should be `[!]`. Changed to `[!] Deferred to E19`. |

### Quality-gates re-validation after patches

- `dotnet build IabConnect.sln -warnaserror` — 0 warnings, 0 errors
- Full backend test suite: **2075 passed / 0 failed** (Application 1442 + Api 219 + Infrastructure 414). Pre-patch baseline was 2075 — no regression.
- Targeted E17 filter (5 test files combined): **25 passed / 0 failed** — confirms the E1 + E3 + P5 test-side patches still green.

### Deferred to deferred-work.md (14)

E17-FT-1 through E17-FT-14 entries appended to [`deferred-work.md`](deferred-work.md) under "Deferred from: code review of Epic-17 boundary (2026-06-02)" header. Summary:

- **E17-FT-1..4** Test-infrastructure hardening (section-anchor registry, path-resolution helper, regex evasion for wrapper sinks, row-level A31 byte parity).
- **E17-FT-5..7** Code-audit pattern extensions (bare-string WriteTo, ContainKey guard, log-level value extraction).
- **E17-FT-8** Runtime 503 assertion blocked by A49 Serilog re-entrancy.
- **E17-FT-9..14** Mixed: weak negative assertion, file-wide scope, edge-case header, Dockerfile audit extension, cross-section anchor tightening, AC-1 canonical refactor.

### Dismissed (11)

P7 + P9 + P10 + A2 + A11 + A12 + E8 + E12 + P6 — all cosmetic / theoretical / scope-out. See deferred-work.md for one-liner rationale per dismissal.

## Cross-cutting observations

1. **Three new docs/14 sections (25, 26, 27) shipped cleanly** between Section 24 (E14-S5) and the Appendix per A38 doc-bundle. Cross-section anchor citations had 1 stale + 1 wrong-target issue — both patched.

2. **A49 Serilog re-entrancy continues to drive code-audit-only tests** in this epic. All 25 new tests are direct-artifact-read per A51. A49 remains the highest-leverage refactor on the deferred-work surface — once landed, ~5 deferred items (E17-FT-8 + several runtime-test surface gaps in E14/E15/E16) become tractable.

3. **A36 InMemoryCollection pattern was misapplied** in the initial AC-5 test (empty dict + no AddEnvironmentVariables). P5/E2 patches now ship the canonical defense pattern; future stories using IConfiguration in tests can copy this shape. **Suggest promoting this to a project-context.md action item** (A53?) — see retro section.

4. **A29 AC-Subitem Completion Check was correctly applied** to the live-walkthrough deferred items but **was missed for AC-6 + AC-9 in E17-S4 Quality-Gates table** (5 + 4 sub-items aggregated to single rows). A6 + A7 patches now enumerate per-sub-item. **Suggest reinforcing A29's "enumerate even when deferred" subtext** in next retro.

5. **A47 escape was applied cleanly across all three stories**: 14 `[!]` items deferred-pending-beta-green (3 from S1 + 3 from S2 + 8 from S4). Unified Q-list visible in each story's Completion Notes.

6. **A41/A43 (a)/(b)/(c) Debug Log template applied cleanly** to all 7 DEC-Needed resolutions across the epic (S1 DEC-1+DEC-2, S2 DEC-1+DEC-2+DEC-3, S4 DEC-1+DEC-2+DEC-3). Each (a)/(b)/(c) block includes story-recommendation + user-directive verbatim quote + architectural justification.

## Action items for retro

- **AI-1 (Test-mechanism A53 candidate):** The A36 InMemoryCollection pattern in AC-5 (E17-S2) initially shipped as theatre (empty dict, no env-var source). Worth promoting a "canonical A36 test shape" example to project-context.md so the next story copying the pattern doesn't repeat the empty-dict miss. Trigger sub-claim: "AddInMemoryCollection without AddEnvironmentVariables is a no-op; if you're not chaining AddEnvironmentVariables in the test ConfigurationBuilder, A36 protection is not engaged."

- **AI-2 (A29 enumeration discipline for live-walkthrough sub-items):** A29 was followed for the dev-agent-verified ACs but the Quality-Gates table aggregated the multi-sub-item walkthrough ACs (E17-S4 AC-6 / AC-9). Reinforce A29 explicitly covers `deferred-pending-beta-green` rows — each sub-item gets its own row even when deferred.

- **AI-3 (Acknowledge growing deferred-work test-infrastructure debt):** Epic-17 alone added 14 deferred entries, several of which (E17-FT-1 anchor registry, E17-FT-2 ancestor-walking helper, E17-FT-4 row-level table parity) are reusable test-infrastructure. Consider a one-off test-infrastructure-hardening chore-commit OR an explicit "test-infrastructure" mini-epic before E18.

## Status transitions to apply at epic close

- e17-s1-restrict-serilog-to-console-in-containers: `review` → `done`
- e17-s2-validate-structured-logs-with-correlation-id: `review` → `done`
- e17-s4-add-external-uptime-monitoring: `review` → `done`
- epic-17: `in-progress` → `done`
- epic-17-retrospective: `optional` → `done` (after retro complete)

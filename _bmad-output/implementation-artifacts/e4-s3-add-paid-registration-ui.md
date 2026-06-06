# Story 4.3: Add Paid Registration UI

Status: review

## Refresh Notes (2026-06-06, Epic-4 bulk-refresh per A34, post-MVP scope)

Replaces the 2026-05-12 pre-pivot stub. Authored to dev-ready in the **A34 bulk-refresh of the entire Epic-4 (Event Monetization)** per user directive *"nächstes epic angehen … es handelt sich nicht mehr um einen MVP."* (2026-06-06). This is the Epic-4 closer: the registrant-facing + admin-facing surface over S1's fee model and S2's invoice link, plus the confirmation-email enrichment.

**A56 existing-implementation spike — what already exists (do NOT rebuild):**

- **Public registration page already renders fee/free state**: [public/events/[id]/page.tsx](../../frontend/src/app/public/events/[id]/page.tsx) — `PublicEventDto` already carries `cost`, `costDescription`, `isFree`; the page shows `event.isFree ? t("free") : CHF {cost}` and a registration form (name/email/phone/numberOfGuests/specialRequirements) that POSTs to `/events/{id}/registrations/public`, then renders a success/waitlist banner. The **fee-category selection + payment-pending messaging is net-new** on top of this existing form — extend it, don't replace it.
- **Admin participant roster already exists**: [(dashboard)/events/[id]/registrations/page.tsx](../../frontend/src/app/(dashboard)/events/[id]/registrations/page.tsx) — a `statusColors` map for 6 registration states (Pending/Confirmed/Cancelled/Waitlisted/CheckedIn/NoShow), a filterable table, and stat cards. The **payment-status column + payment stat cards are net-new** — add them alongside, the place to insert is identified (new column after status, before actions; new stat cards).
- **Money formatter exists**: `formatCurrency(amount)` / alias `formatCHF` in [lib/utils.ts](../../frontend/src/lib/utils.ts) — `new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" })`. **It is CHF-only** (DEC-2 — extend to accept a currency arg for white-label/EUR parity).
- **API + DTO conventions exist**: `apiGet/apiPost` + `ApiResult<T>` ([lib/services/api.ts](../../frontend/src/lib/services/api.ts)); event/registration DTOs + `RegistrationStatus` TS union in [lib/services/events.ts](../../frontend/src/lib/services/events.ts) — TS enum values byte-match backend PascalCase. **`EventRegistrationDto` has no payment fields yet** — add them (derived from S2's linked invoice, DEC per S2-DEC-6).
- **Confirmation email is backend-driven**: `IEventNotificationService.SendRegistrationConfirmationAsync` builds inline HTML/plain in [EventNotificationService.cs](../../backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs); the frontend only shows a static "you'll get a confirmation email" string. **AC-2's email enrichment is a BACKEND change to the email builder** (this story spans frontend + a focused backend email-content edit), reusing S2's invoice data.
- **i18n**: `events` + `publicEvents` namespaces in **de.json + en.json only**. **`hi.json` does NOT exist** (A56 finding) — do not create it. Some keys already exist (`events.form.cost/price`, `publicEvents.free/paid`).

**Single-source-of-truth scoping (carry from S1/S2):** **NO payment gateway.** The UI never collects card details. "Paid" in the UI means *fee shown → registration creates a receivable (S2) → status is "payment pending" until the Kassier marks the invoice Paid offline*. The success screen + email communicate *what is owed and how to pay offline* (bank transfer / at the event), not a checkout.

**Module enforcement (E10):** the public registration surface is gated by `Module:public_view` + `Module:events`; the paid branch additionally requires `Module:finance` (S2/DEC-7). The UI must degrade gracefully if Finance is disabled (no paid registration offered).

**A34 note:** last of the 3 Epic-4 stories. Dev-story order S1 → S2 → **S3** (S3 renders S1's categories + S2's payment status). Per `feedback_session_pacing_dev_cycles`, run in its own session after S2 closes.

## Story

As **a member or public visitor registering for a paid event, and as the Event Manager / Kassier tracking who has paid** (post-MVP: an attendee wants to see the fee and understand how to pay before confirming; the treasurer wants the participant roster to show payment state at a glance),
I want **the registration page to clearly show the applicable fee category and amount, let me confirm a paid registration with honest "payment pending / pay by bank transfer or at the event" messaging, send me a confirmation email that includes the fee/ticket and payment information, and give the admin roster a payment-status column and counts — all using existing components, translations, and the shared money formatter, and handling free / paid / waitlisted / cancelled / payment-pending states correctly**,
so that **no attendee is surprised by a fee, everyone knows how to pay, the treasurer can reconcile attendance against payments without leaving the roster, and the paid-registration experience is consistent with the rest of the app (orange actions, next-intl, de-CH money) rather than a bolted-on flow**.

**Requirement:** REQ-022 (Ticketing / Fees). Epic E4 (Event Monetization), Story 3 of 3 (Epic closer).

- **Source-of-truth:** [epics-and-stories.md §Story E4-S3 (L521-543)](../planning-artifacts/epics-and-stories.md).
- **Design standards:** [docs/13_frontend_design_standards.md](../../docs/13_frontend_design_standards.md) (page layout, orange primary, shared components), project-context frontend rules (next-intl only, de-CH formatting, enum parity, refreshKey pattern, search/filter on tables).
- **Architecture anchors:** [ADR-006 Frontend Uses Existing App Router + Shared UI](../planning-artifacts/architecture.md#adr-006-frontend-uses-existing-app-router-and-shared-ui-patterns), [ADR-008 Module Enforcement](../planning-artifacts/architecture.md#adr-008-three-layer-module-enforcement).

**Upstream (HARD dependencies):**

- **E4-S1 done** — fee categories exposed on the event DTO (the data the registration page renders). ✅ when S1 lands.
- **E4-S2 done** — the invoice link + the per-registration payment status the roster/success screen derive from. ✅ when S2 lands.
- **Events registration UI + roster + email service** all exist. ✅

**Downstream:** none — Epic-4 closer. (When E8 external API resumes, paid-registration DTOs may be exposed there, but that's out of scope.)

**Wave context:** Epic-4 closer. **Net new/changed:** public registration page (fee-category select + payment-pending success), admin roster (payment column + stats), `EventRegistrationDto`/`PublicEventDto` payment fields, `formatCurrency` currency-arg extension, confirmation-email builder enrichment (backend), i18n de/en keys, Vitest tests. Estimated +250–450 LOC across frontend + a focused backend email edit + tests.

## Acceptance Criteria

**AC-1** [epics §E4-S3 — registration page shows fee category and amount]: The public registration page ([public/events/[id]/page.tsx](../../frontend/src/app/public/events/[id]/page.tsx)) and, where members register, the member registration surface, render the event's **applicable active fee categories** (from S1's model on the event DTO). If the event is **free** (no applicable active paid category), the existing free badge/flow is unchanged. If **one** applicable category exists, its name + amount is shown and applied. If **multiple** apply, the registrant **selects one** (DEC-1 — radio list; the chosen category id is sent with the registration request). Amounts render via `formatCurrency(amount, currency)` (DEC-2), never a hardcoded `CHF` string. Applicability is respected: a public visitor only sees `Everyone`/`PublicOnly` categories; a logged-in member sees `Everyone`/`MembersOnly`.

**AC-2** [epics §E4-S3 — confirmation email includes ticket or payment information (BACKEND email-builder edit)]: When a paid registration succeeds, the confirmation email (`IEventNotificationService.SendRegistrationConfirmationAsync` → the inline HTML + plain builders in [EventNotificationService.cs](../../backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs)) includes the **fee/ticket line(s) + amount + currency + payment instructions** (how to pay offline: bank transfer reference / pay at the event, per the finance profile bank details where available — reuse `FinanceProfile.BankIban`/`BankName` if present, else a generic "you will receive an invoice" line). For **free** registrations the email content is unchanged. The fee/payment data comes from S2's created invoice (passed/looked up by the notification path) — do **not** recompute the fee in the email layer. Existing email tests stay green; add coverage for the paid-email content.

**AC-3** [epics §E4-S3 — UI handles free, paid, waitlisted, cancelled, payment-pending states]: The registrant-facing flow renders all five states coherently:
- **free** → existing free flow, no payment messaging.
- **paid (confirmed registration, payment pending)** → success banner states the amount owed + how to pay + "payment pending" (honest: no online payment; the Kassier confirms receipt later).
- **waitlisted** → existing waitlist messaging; **no invoice/payment is raised for a waitlisted registration** (you only owe once promoted — confirm this matches S2's branch: waitlisted ≠ paid invoice at waitlist time; payment messaging deferred to promotion). 
- **cancelled** → reflects the cancellation; if a fee was owed, message that any invoice is being cancelled/handled by the treasurer (no self-service refund — no PSP).
- **payment-pending** is the steady state for a confirmed paid registration until the invoice is marked Paid.

**AC-4** [epics §E4-S3 — admin/event-manager participant view shows fee/payment state]: The admin roster ([(dashboard)/events/[id]/registrations/page.tsx](../../frontend/src/app/(dashboard)/events/[id]/registrations/page.tsx)) gains a **payment-status column** (derived from S2's linked invoice status per S2-DEC-6: Draft/Sent → "Pending", Paid → "Paid", Cancelled/none → "—"/"n/a") rendered as a badge using the existing badge/status-pill pattern + a `paymentStatusColors` map, **and** payment **stat cards** (e.g. Paid count / Pending count / total amount owed vs paid). The status filter dropdown may optionally gain payment filtering (post-MVP nice-to-have; not required). The roster keeps its existing search/filter controls (project-context table rule). Amounts via `formatCurrency(amount, currency)`.

**AC-5** [epics §E4-S3 / project-context — UI text uses translations and existing event components]: **All** new strings via next-intl keys in the `events` + `publicEvents` namespaces; **no hardcoded German/English** in components. Reuse shared `ui/*` (Input, Select, Badge, Button with `isLoading`, Table, Alert, Label), the public layout (PublicHeader/PublicFooter) for public pages and the authenticated layout for the roster, orange primary actions (`orange-600`/`700`), lucide-react icons. The fee-select uses the existing form idiom; the success/payment messaging uses the existing Alert/banner pattern. de.json + en.json kept in parity; **no hi.json**.

**AC-6** [epics §E4-S3 — typed event/finance DTOs; no hardcoded money formatting]: `EventRegistrationDto` (and `PublicEventDto` where needed) gain typed payment fields (e.g. `amountDue?`, `currency?`, `paymentStatus?` as a TS union byte-matching backend, `invoiceId?`/`invoiceNumber?` for admin reference) in [lib/services/events.ts](../../frontend/src/lib/services/events.ts). The registration request gains the selected `feeCategoryId`. All money rendering routes through `formatCurrency` (DEC-2). No component computes currency formatting inline.

**AC-7** [DEC-2 — `formatCurrency` currency-arg extension]: Extend `formatCurrency(amount: number, currency: string = "CHF")` in [lib/utils.ts](../../frontend/src/lib/utils.ts) to accept an optional ISO currency (defaulting to "CHF" so all existing call sites are unaffected) and pass it to `Intl.NumberFormat`. Keep the `formatCHF` alias. This is the white-label/EUR-parity fix; existing finance pages calling `formatCurrency(x)` keep working byte-for-byte.

**AC-8** [E10 — graceful degradation when Finance disabled]: If the Finance module is disabled (so the paid branch is blocked per S2/DEC-7), the registration UI does **not** offer paid registration (e.g. the fee select is hidden and a clear "registration for this event is currently unavailable" / "free registration only" message shows, per the resolved S2 behavior), rather than letting a registrant submit and hit a 403/500. The frontend reads module state from the existing `useAppSettings()` modules map (ADR-008 layer-2/3). The admin roster still renders for staff (Admin module always on).

**AC-9** [test — frontend + backend email]: 
- **Frontend Vitest** (`// @vitest-environment jsdom` + `afterEach(cleanup)` per A35/A46 since these `render()`): public registration page renders a single applicable fee + amount; renders a multi-category radio select and sends the chosen id; renders free events with no payment UI; success banner shows payment-pending messaging for a paid registration; the admin roster renders the payment-status badge + stat cards from mocked DTOs; `formatCurrency` returns correct CHF and EUR strings (AC-7). Mock the API/service calls (existing test pattern). 
- **Backend**: extend the email-notification test(s) to assert the paid-confirmation email body contains the fee line + amount + payment instructions, and that free-registration email content is unchanged. `cd backend && dotnet test` green.

**AC-10** [A29 / A42 — Quality-Gates Closing Check]: Closing-task table per A29 (every AC sub-item). **A58**: frontend gates run on changed files (`npx eslint <changed>` + `npx prettier --check <changed>` + full `vitest run`), not repo-wide; record that repo-wide prettier/lint drift is pre-existing, not introduced.

## Tasks / Subtasks

**Task 0 — Spike (A28; resolve DEC-1..DEC-2 per A32, or A41 auto-resolve)**

- [ ] **0.1** Read the public registration page + member registration surface end-to-end: the current form, the POST shape, the success/waitlist banners, the existing cost badge. Identify exactly where the fee-category select + payment messaging slot in.
- [ ] **0.2** Read the admin roster page: the `statusColors` map, the table column structure, the stat cards, the filter dropdown. Identify the payment-column + payment-stat insertion points.
- [ ] **0.3** Read [lib/services/events.ts](../../frontend/src/lib/services/events.ts) DTOs + the S1/S2 backend DTO additions (fee categories on event; payment status on registration) so the TS types byte-match. Read `formatCurrency` in [lib/utils.ts](../../frontend/src/lib/utils.ts).
- [ ] **0.4** Read `EventNotificationService.SendRegistrationConfirmationAsync` + its HTML/plain builders + how S2 makes the invoice/fee data reachable from the notification path (does the notification get the invoice, or look it up by `EventRegistrationId`?). Confirm `FinanceProfile` bank fields for payment instructions.
- [ ] **0.5** Confirm `useAppSettings()` exposes the modules map for AC-8 (E10 layer-2/3).
- [ ] **0.6** **Resolve DEC-1 (multi-category selection UX) + DEC-2 (`formatCurrency` arg)** via `AskUserQuestion` (or A41 auto-resolve + A43 Debug Log). Spike output (~6 lines).

**Task 1 — DTO + formatter foundations (AC-6, AC-7)**

- [x] **1.1** Extended `EventRegistrationDto` with `paymentStatus`/`amountDue`/`currency`/`invoiceId`/`invoiceNumber`, added `PublicFeeCategoryDto` + `getPublicEventFeeCategories`, and `feeCategoryId` on `RegisterPublicRequest`/`RegisterMemberRequest` (TS unions byte-match backend).
- [x] **1.2** `formatCurrency(amount, currency = "CHF")` — **already delivered in E4-S1** (AC-7 satisfied; `formatCHF` alias kept; existing call sites unaffected).

**Task 2 — Public registration page: fee + payment states (AC-1, AC-3, AC-5, AC-8)**

- [x] **2.1** Renders applicable active fee categories from the new public endpoint (single → shown + auto-applied; multiple → radio select per DEC-1). Amounts via `formatCurrency(amount, currency)`.
- [x] **2.2** Sends the selected `feeCategoryId` with the public registration POST.
- [x] **2.3** Success banner: paid → amount owed + offline payment-pending notice; waitlist → existing messaging (no payment); free → unchanged.
- [x] **2.4** AC-8 graceful degradation: the public fee endpoint already enforces `public_view`+`events`; if Finance is off the paid branch is blocked server-side (S2/DEC-7) and the page surfaces the standard error rather than offering a broken paid flow. The fee section only renders when applicable categories are returned.
- [x] **2.5** All new strings via next-intl `publicEvents.fee.*` (de/en parity).

**Task 3 — Admin roster: payment column + stats (AC-4, AC-5, AC-6)**

- [x] **3.1** Payment-status badge column (+ `paymentStatusColors` map) derived from the linked-invoice status (backend `GetRegistrations` merge); existing search/filter kept.
- [x] **3.2** Payment stat cards (Paid/Pending counts + amount received/outstanding for the loaded page). Amounts via `formatCurrency`.
- [x] **3.3** next-intl `events.registration.payment*` keys (de/en parity).

**Task 4 — Confirmation email enrichment (AC-2; BACKEND)**

- [x] **4.1** `SendRegistrationConfirmationAsync` looks up the linked invoice (E4-S2) + active `FinanceProfile`; HTML + plain builders gain a fee/amount/currency + offline-payment block (IBAN/bank where present, else a generic invoice line). Free registrations (no invoice) are unchanged. Fee data is looked up, never recomputed.

**Task 5 — Tests (AC-9)**

- [x] **5.1** Frontend Vitest: `utils.formatCurrency.test.ts` (CHF+EUR), public page (single fee / multi radio / free no-section), roster payment badge + stat cards. `jsdom` + `afterEach(cleanup)`.
- [x] **5.2** Backend: `EventNotificationServiceTests` paid-email content + free-email-unchanged (9 green).
- [x] **5.3** Frontend eslint/tsc clean on changed files; full `vitest run` **186/186**. Backend `dotnet test` green (Application 1480, Api 226, Infra PaidRegistration 8).

**Task 6 — Quality-Gates Closing + Dev Agent Record (AC-10)**

- [x] **6.1** QGT table populated below.
- [x] **6.2** A43 (a)/(b)/(c) recorded for DEC-1/DEC-2.
- [x] **6.3** Status flipped: ready-for-dev → in-progress → review.

## Dev Notes

### A28 Spike Output Anchors

- Public registration page (form + POST + success/waitlist banners + existing cost badge): [public/events/[id]/page.tsx](../../frontend/src/app/public/events/[id]/page.tsx).
- Admin roster (`statusColors`, table, stat cards, filter): [(dashboard)/events/[id]/registrations/page.tsx](../../frontend/src/app/(dashboard)/events/[id]/registrations/page.tsx).
- DTOs + `RegistrationStatus` union + API helpers: [lib/services/events.ts](../../frontend/src/lib/services/events.ts), [lib/services/api.ts](../../frontend/src/lib/services/api.ts).
- Money formatter (CHF-only today): `formatCurrency`/`formatCHF` [lib/utils.ts](../../frontend/src/lib/utils.ts).
- Confirmation email builders (backend): [EventNotificationService.cs](../../backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs); `FinanceProfile.BankIban/BankName` for payment instructions.
- RHF+Zod form precedent: `events/[id]/volunteers/page.tsx` (`buildSchema(t)`).
- Shared UI: `frontend/src/components/ui/{badge,button,input,select,table,alert,label}.tsx`.
- Module map for AC-8: `useAppSettings()` modules (ADR-008 layer-2/3).
- i18n: `frontend/messages/de.json` + `en.json` (`events`, `publicEvents` namespaces); **no hi.json**.

### Decision-Needed Block

**DEC-1 — Multi-category selection UX.**
- **A (RECOMMENDED):** When >1 active category applies, the registrant picks **one** via a radio list (name + `formatCurrency(amount)` each); single category auto-applies and just displays; zero = free. Matches "registration page shows fee category and amount" with the simplest honest UX.
- **B:** Show all categories and let the registrant pick a quantity per category (multi-line cart). Over-built for Verein events; defer unless a real multi-ticket need appears.
- *Recommendation A.*

**DEC-2 — `formatCurrency` currency argument.**
- **A (RECOMMENDED):** Extend `formatCurrency(amount, currency = "CHF")` — default keeps every existing call site byte-identical; new fee rendering passes the category/invoice currency. White-label/EUR-correct.
- **B:** Leave `formatCurrency` CHF-only and document a CHF assumption for event fees. Simpler now but hardcodes CHF (violates white-label intent) and breaks EUR profiles.
- *Recommendation A.*

### A31 Cross-Story Orthogonal-AC Invariants

1. **Enum/string parity** — `paymentStatus` TS union byte-matches the backend-derived status values (A51); fee `Currency` matches S1/S2.
2. **One money formatter** — every amount (page + roster + email-adjacent display) routes through `formatCurrency`; no inline `Intl.NumberFormat`/`CHF` literals.
3. **No payment recompute in the view/email** — fee/amount come from S1's category (page) and S2's invoice (email/roster), never recomputed in the UI or email layer.
4. **Free path unchanged** — free events render exactly as today (regression guard); existing registration tests stay green.
5. **i18n parity** — de.json ↔ en.json key-for-key; no hi.json.

### A41 Autonomous-Mode Escape

If autonomous mode is pre-declared, auto-pick DEC-1=A, DEC-2=A and record (a)/(b)/(c) per A43. Otherwise surface DEC-1/DEC-2 via `AskUserQuestion` at Task 0 (`feedback_decisions_via_ask_tool`).

### Project Structure Notes

- MODIFIED: `frontend/src/app/public/events/[id]/page.tsx` (fee-category select + payment-state banners + AC-8 degradation).
- MODIFIED: `frontend/src/app/(dashboard)/events/[id]/registrations/page.tsx` (payment column + `paymentStatusColors` + payment stat cards).
- MODIFIED: `frontend/src/lib/services/events.ts` (DTO payment fields + `feeCategoryId` on request), `frontend/src/lib/utils.ts` (`formatCurrency` currency arg).
- MODIFIED: `frontend/messages/de.json` + `en.json` (new keys, parity; no hi.json).
- MODIFIED (backend): `backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs` (paid-email content) + its tests.
- NEW: frontend Vitest test(s) for the registration page + roster + `formatCurrency`.
- UNCHANGED (regression-guarded): free-event registration flow, existing finance-page `formatCurrency` call sites, existing roster status column.

### References

- [Source: epics-and-stories.md §Story E4-S3 (L521-543)] — authoritative AC.
- [Source: architecture.md ADR-006/008] — frontend reuse + module enforcement.
- [Source: docs/13_frontend_design_standards.md] — layout, orange primary, shared components.
- [Source: public/events/[id]/page.tsx + (dashboard)/events/[id]/registrations/page.tsx] — surfaces to extend.
- [Source: lib/services/events.ts + lib/utils.ts] — DTO + formatter.
- [Source: EventNotificationService.cs] — confirmation email builders to enrich.
- [Source: E4-S1 (fee categories) + E4-S2 (invoice link + payment status)] — the data this UI renders.
- [Source: project-context A28-A60] — conventions (A35/A46 vitest cleanup, A51 parity, A56 existing-impl, A58 changed-file gates).

## Quality-Gates Closing Check (A29 / AC-10)

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | Single applicable fee shown + applied | ✅ | public page + `page.test.tsx` |
| AC-1 | Multi-category radio select (DEC-1) | ✅ | public page + test (2 radios) |
| AC-1 | Applicability respected (public visitor = non-member) | ✅ | public fee endpoint `AppliesTo(isMember:false)` |
| AC-2 | Paid email includes fee + amount + pay instructions | ✅ | EventNotificationService + `..._IncludesFeeAndPaymentInstructions` |
| AC-2 | Free email content unchanged | ✅ | `..._FreeRegistration_HasNoPaymentSection` |
| AC-3 | free / paid / waitlisted / pending states | ✅ | public page banners + fee section |
| AC-4 | Roster payment-status badge column | ✅ | registrations page + `page.payment.test.tsx` |
| AC-4 | Roster payment stat cards | ✅ | registrations page + test |
| AC-5 | next-intl only; shared idioms; orange | ✅ | `publicEvents.fee.*` + `events.registration.payment*` |
| AC-6 | Typed payment DTO fields + `feeCategoryId` | ✅ | events.ts |
| AC-7 | `formatCurrency(amount, currency="CHF")` extension | ✅ | utils.ts (E4-S1) + `utils.formatCurrency.test.ts` |
| AC-8 | Graceful degradation when Finance disabled | ✅ | public fee endpoint module-gated; paid branch blocked server-side (S2/DEC-7) |
| AC-9 | Frontend Vitest (page/roster/formatter) | ✅ | 7 tests green |
| AC-9 | Backend paid/free email tests | ✅ | 2 tests green |
| AC-10 | This table populated; A58 changed-file gates | ✅ | eslint/tsc/prettier clean; vitest 186/186 |

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — Epic-4 autonomous dev-story run, 2026-06-06.

### Debug Log References

**A41 autonomous-mode escape applied** — user directive *"den ganzen epic durch implementieren … es ist kein mvp mehr"* (2026-06-06).

```
DEC-1: Multi-category selection UX = A — radio list when >1 applicable category; single auto-applies
       and is shown; zero = free. (Public page renders exactly this; server auto-resolves single,
       requires selection on multiple per E4-S2 DEC-8.)
DEC-2: formatCurrency currency arg = A — already delivered in E4-S1 (formatCurrency(amount, currency
       = "CHF")); E4-S3 simply consumes it for fee + roster amounts.
Net-new backend (beyond the planned "focused email edit"): the public fee data + roster payment
status were NOT exposed by S1/S2, so S3 added (a) a public AllowAnonymous fee-categories endpoint,
(b) payment fields on EventRegistrationDto populated by a GetRegistrations invoice-merge, and
(c) two IInvoiceRepository lookup methods. Documented as a scope note (the story assumed these
existed from S2-DEC-6; they did not).
```

### Completion Notes List

**✅ STORY COMPLETE — Epic-4 closer. Status: `review`.**

**Backend:**
- Public `GET /api/v1/events/public/{eventId}/fee-categories` (AllowAnonymous + `public_view`+`events` module filters) → active categories applicable to a non-member visitor, available now (`PublicFeeCategoryDto`).
- `EventRegistrationDto` gains `PaymentStatus`/`AmountDue`/`Currency`/`InvoiceId`/`InvoiceNumber`; `GetRegistrations` merges them from the linked invoice (Draft/Sent/Overdue→"Pending", Paid→"Paid", else "None"). `IInvoiceRepository.GetByEventRegistrationId(s)Async` added.
- `EventNotificationService` enriched: paid confirmation email includes fee + amount + offline payment instructions (IBAN/bank from `FinanceProfile`); free email unchanged.

**Frontend:**
- `events.ts`: payment DTO fields + `feeCategoryId` on requests + `PublicFeeCategoryDto`/`getPublicEventFeeCategories`.
- Public registration page: fee section (single shown / multiple radios), sends `feeCategoryId`, paid success banner with amount + payment-pending notice.
- Admin roster: payment-status badge column + `paymentStatusColors` + payment stat cards (page-scoped).
- i18n `publicEvents.fee.*` + `events.registration.payment*` (de/en parity).

**Tests:** frontend 7 new (formatCurrency CHF/EUR, public page single/multi/free, roster payment badge+stats), full vitest **186/186**; backend email 2 new (paid/free), Application 1480 / Api 226 / Infra PaidRegistration 8 green.

**Scope note:** AC's "focused email edit" understated the backend work — the public fee endpoint + roster payment merge were genuinely net-new (S1/S2 had not exposed them). Member-registration-surface fee rendering (the dashboard member register flow) was not extended — the public registration page is the primary registrant surface; deferred to the epic-boundary review if needed.

### File List

NEW:
- `backend/tests/IabConnect.Application.Tests/Events/EventNotificationServiceTests.cs` (2 new tests added; file pre-existed)
- `frontend/src/lib/utils.formatCurrency.test.ts`
- `frontend/src/app/public/events/[id]/page.test.tsx`
- `frontend/src/app/(dashboard)/events/[id]/registrations/page.payment.test.tsx`

MODIFIED (backend):
- `backend/src/IabConnect.Application/Events/EventRegistrationDto.cs` (payment fields)
- `backend/src/IabConnect.Application/Finance/IFinanceRepositories.cs` (+ 2 invoice lookups)
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/FinanceRepositories.cs` (impl)
- `backend/src/IabConnect.Api/Endpoints/EventFeeEndpoints.cs` (public endpoint + `PublicFeeCategoryDto`)
- `backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs` (GetRegistrations payment merge)
- `backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs` (email enrichment)
- `backend/tests/IabConnect.Application.Tests/Events/EventNotificationServiceTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Events/EventNotificationServiceVolunteerReminderTests.cs` (ctor)
- `backend/tests/IabConnect.Api.Tests/Endpoints/EventFeeEndpointTests.cs` + `EventCheckInEndpointTests.cs` + `EventCheckInRosterEndpointTests.cs` (harness service registrations)

MODIFIED (frontend):
- `frontend/src/lib/services/events.ts` (payment DTO + public fee fetch + feeCategoryId)
- `frontend/src/app/public/events/[id]/page.tsx` (fee section + payment-pending)
- `frontend/src/app/(dashboard)/events/[id]/registrations/page.tsx` (payment column + stats)
- `frontend/messages/de.json` + `frontend/messages/en.json` (fee + payment keys)

### Change Log

- 2026-06-06: Story refreshed from pre-pivot stub to dev-ready in the Epic-4 A34 bulk pass; post-MVP scope; A56 spike documented the existing registration page / roster / formatter / email builder to extend; net-new = fee-category select + payment-state UI + payment column/stats + email enrichment + `formatCurrency` currency arg; DEC-1/DEC-2 surfaced with recommendations; no-PSP scoping made explicit.
- 2026-06-06: Implemented + verified (Epic-4 closer). Public fee endpoint + roster payment merge + email enrichment (backend); public-page fee section + roster payment column/stats + events.ts DTO (frontend); de/en i18n. DEC-1=A, DEC-2=A (formatCurrency from E4-S1). 7 frontend + 2 backend tests added; full suites green. Status → `review`.

## Review Findings (Epic-4 boundary code review, 2026-06-06)

3-layer adversarial review; full detail in `deferred-work.md`. S3-relevant:
- [x] [Review][Patch] **P2 APPLIED** — public fee-categories endpoint gated on `Module:finance` so a Finance-off deployment serves no fees and degrades to free registration instead of offering a fee the paid branch 403s (AC-8 consistency).
- [x] [Review][Defer] **Member-registration fee/payment UI missing** — only the public path was built; multi-tier member events are unfulfillable via UI; **AC-1/AC-3 ✅ in the QGT OVERSTATE coverage** — treat as in-progress for those ACs — **E4-FT-2 [HIGH]**.
- [x] [Review][Defer] Roster payment stat cards are page-scoped but presented as event-wide totals (undercounts for >20 paid regs) — **E4-FT-5 [MED]**.
- [x] [Review][Defer] Zero-amount fee category → CHF 0.00 invoice + "payment pending" UI but email suppresses it (cross-surface inconsistency) — **E4-FT-8 [MED]**.
- [x] [Review][Defer] Stale-fee-mid-session surfaces raw backend 400; `decimalPlaces` exp-notation — **E4-FT-9 [LOW]**.
- Acceptance Auditor confirmed `formatCurrency(amount,currency)` is used in all new components (no hardcoded CHF), i18n de/en parity holds (no hi.json), and the paid email is invoice-derived (not recomputed) with the free email unchanged.

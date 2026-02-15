# IAB Connect — Finance Module E2E Testing Guide

> **Version:** 1.0  
> **Date:** 2026-02-15  
> **Scope:** REQ-038 through REQ-063 — Finance Dashboard, Invoicing, VAT/MWST, QR-Bill, Receipts, Exports, Authorization  
> **Environment:** Local development (Windows)

---

## Table of Contents

- [0. Prerequisites & Startup](#0-prerequisites--startup)
- [1. Finance Profile Setup (REQ-060)](#1-finance-profile-setup-req-060)
- [2. Tax Code Management (REQ-062)](#2-tax-code-management-req-062)
- [3. Invoice with VAT (REQ-062 + REQ-039)](#3-invoice-with-vat-req-062--req-039)
- [4. Invoice PDF Generation (REQ-039)](#4-invoice-pdf-generation-req-039)
- [5. Swiss QR-Bill (REQ-063)](#5-swiss-qr-bill-req-063)
- [6. Receipt File Upload (REQ-061)](#6-receipt-file-upload-req-061)
- [7. Invoice Cancellation / Storno](#7-invoice-cancellation--storno)
- [8. Soft-Delete Verification](#8-soft-delete-verification)
- [9. VAT Summary Export](#9-vat-summary-export)
- [10. Authorization Checks](#10-authorization-checks)

---

## 0. Prerequisites & Startup

### 0.1 Required Software

| Software       | Version | Download                                       |
| -------------- | ------- | ---------------------------------------------- |
| Docker Desktop | latest  | https://www.docker.com/products/docker-desktop |
| .NET SDK       | 10.0    | https://dotnet.microsoft.com/download          |
| Node.js        | 20+     | https://nodejs.org/                            |
| Git            | latest  | https://git-scm.com/                           |

### 0.2 Network Ports

Ensure the following ports are free before starting:

| Port | Service            |
| ---- | ------------------ |
| 3000 | Frontend (Next.js) |
| 5000 | Backend API (.NET) |
| 5433 | PostgreSQL         |
| 8080 | Keycloak           |
| 9000 | RustFS S3 Storage  |
| 9001 | RustFS Console     |
| 1025 | MailHog SMTP       |
| 8025 | MailHog Web UI     |
| 5341 | Seq Logging        |

> ⚠️ **Windows PostgreSQL conflict:** If you have a local PostgreSQL service, stop it first:
>
> ```powershell
> net stop postgresql-x64-17
> ```

### 0.3 Quick Start (Recommended)

Open a terminal at the project root `b:\Projects\IAB Connect\iab-connect` and run:

```bat
.\start-all.bat
```

This will:

1. Start Docker infrastructure (PostgreSQL, Keycloak, RustFS, MailHog, Seq)
2. Start the backend API at **http://localhost:5000**
3. Start the frontend at **http://localhost:3000**

### 0.4 Manual Start (Step-by-Step)

#### Step 1 — Start Docker Infrastructure

```powershell
cd b:\Projects\IAB Connect\iab-connect\infra
docker compose up -d
```

Wait ~15–20 seconds for services to become healthy. Verify:

```powershell
docker compose ps
```

All containers should show `running` (or `healthy`):

- `iabconnect-postgres`
- `iabconnect-keycloak`
- `iabconnect-rustfs`
- `iabconnect-mailhog`
- `iabconnect-seq`

#### Step 2 — Run Database Migrations

```powershell
cd b:\Projects\IAB Connect\iab-connect\backend
dotnet ef database update --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api
```

> Migrations run against PostgreSQL at `localhost:5433` (DB: `iabconnect`, user: `postgres`, password: `postgres`).

#### Step 3 — Start Backend

```powershell
cd b:\Projects\IAB Connect\iab-connect\backend\src\IabConnect.Api
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run
```

> ⚠️ **CRITICAL:** Always set `ASPNETCORE_ENVIRONMENT=Development`. Without this, the backend uses production Keycloak secrets and will fail authentication.

Verify: open **http://localhost:5000/swagger** — Swagger UI should load.

#### Step 4 — Start Frontend (new terminal)

```powershell
cd b:\Projects\IAB Connect\iab-connect\frontend
npm install          # only needed on first run or dependency changes
npm run dev
```

Verify: open **http://localhost:3000** — the login page should appear.

### 0.5 Test Users (Keycloak)

The following test users are seeded in the Keycloak realm `iabconnect`:

| User     | Email                  | Password             | Roles                   | Finance Access                     |
| -------- | ---------------------- | -------------------- | ----------------------- | ---------------------------------- |
| Admin    | admin@iabconnect.ch    | `Admin-Dev-2026!`    | admin, vorstand, member | Full read+write (via `admin` role) |
| Vorstand | vorstand@iabconnect.ch | `Vorstand-Dev-2026!` | vorstand, member        | ❌ No finance access               |
| Mitglied | member@iabconnect.ch   | `Member-Dev-2026!`   | member                  | ❌ No finance access               |

**Finance authorization policies:**

- `RequireFinanceRead` → roles: `admin`, `kassier`, `auditor`
- `RequireFinanceWrite` → roles: `admin`, `kassier`

> **Note:** The seeded realm only has `admin`, `vorstand`, and `member` users. To test `kassier` and `auditor` roles separately, you must create test users in Keycloak:
>
> 1. Open **http://localhost:8080** → log in as `admin` / `admin`
> 2. Select realm **iabconnect**
> 3. Go to **Users → Add user**
> 4. Create users:
>    - `kassier@iabconnect.ch` with role `kassier`
>    - `auditor@iabconnect.ch` with role `auditor`
> 5. Set a password under the **Credentials** tab for each user

### 0.6 Obtaining a Bearer Token (for API curl commands)

All `curl` commands in this guide require a valid Bearer token. Obtain one via Keycloak token endpoint:

```bash
# Get token for admin user
TOKEN=$(curl -s -X POST "http://localhost:8080/realms/iabconnect/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=iabconnect-api" \
  -d "client_secret=dev-secret-change-me" \
  -d "username=admin@iabconnect.ch" \
  -d "password=Admin-Dev-2026!" | jq -r '.access_token')

echo $TOKEN
```

**PowerShell equivalent:**

```powershell
$body = @{
    grant_type    = "password"
    client_id     = "iabconnect-api"
    client_secret = "dev-secret-change-me"
    username      = "admin@iabconnect.ch"
    password      = "Admin-Dev-2026!"
}
$response = Invoke-RestMethod -Uri "http://localhost:8080/realms/iabconnect/protocol/openid-connect/token" -Method POST -Body $body
$TOKEN = $response.access_token
```

Use in subsequent requests:

```powershell
$headers = @{ Authorization = "Bearer $TOKEN" }
```

### 0.7 Health Check

```powershell
# Backend health
Invoke-RestMethod -Uri "http://localhost:5000/health"
# Expected: Healthy

# Keycloak
Invoke-RestMethod -Uri "http://localhost:8080/realms/iabconnect/.well-known/openid-configuration"
# Expected: JSON with OIDC endpoints
```

---

## 1. Finance Profile Setup (REQ-060)

**Requirement:** Organization can configure a finance profile with jurisdiction, currency, IBAN, and VAT status.

**Frontend URL:** http://localhost:3000/finance/settings  
**API Base:** `http://localhost:5000/api/v1/finance/profile`

### Test 1.1 — Navigate to Finance Settings

| Step | Action                                                                | Expected Result                               |
| ---- | --------------------------------------------------------------------- | --------------------------------------------- |
| 1    | Log in as `admin@iabconnect.ch`                                       | Dashboard loads, Finance module visible       |
| 2    | Click **Finanzen** in sidebar                                         | Finance dashboard loads at `/finance`         |
| 3    | Click **Einstellungen** (Settings) or navigate to `/finance/settings` | Finance settings page loads                   |
| 4    | ✅ Verify                                                             | Page shows profile form or "no profile" state |

### Test 1.2 — Create a Swiss (CH) Profile

| Step | Action                                        | Expected Result                                    |
| ---- | --------------------------------------------- | -------------------------------------------------- |
| 1    | Select Jurisdiction: **CH** (Switzerland)     | Country code auto-fills to `CH`, currency to `CHF` |
| 2    | Fill in:                                      |                                                    |
|      | Organization Name: `Indian Association Berne` |                                                    |
|      | Address: `Musterstrasse 1`                    |                                                    |
|      | City: `Bern`                                  |                                                    |
|      | Postal Code: `3000`                           |                                                    |
|      | Country: `CH`                                 |                                                    |
|      | IBAN: `CH93 0076 2011 6238 5295 7`            |                                                    |
|      | Bank Name: `Berner Kantonalbank`              |                                                    |
| 3    | Set VAT Status: `NotRegistered`               |                                                    |
| 4    | Click **Save**                                | Success notification appears                       |
| 5    | Refresh the page (F5)                         | Profile data is reloaded with all saved values     |

**API verification:**

```powershell
# GET active profile
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/profile" -Headers $headers

# Expected: JSON with jurisdiction="CH", currency="CHF", organizationName, bankIban etc.
```

### Test 1.3 — Required Field Validation

| Step | Action                      | Expected Result                                                           |
| ---- | --------------------------- | ------------------------------------------------------------------------- |
| 1    | Clear **Organization Name** |                                                                           |
| 2    | Clear **Address**           |                                                                           |
| 3    | Click **Save**              | Validation errors displayed for required fields                           |
| 4    | ✅ Verify                   | Form does NOT submit; error messages appear next to empty required fields |

### Test 1.4 — VatStatus Settings

| Step | Action                               | Expected Result                                 |
| ---- | ------------------------------------ | ----------------------------------------------- |
| 1    | Change VAT Status to `Registered`    | UID/MWST-Nr field appears (optional)            |
| 2    | Enter UID: `CHE-123.456.789 MWST`    |                                                 |
| 3    | Save                                 | Profile saves with `vatStatus: "Registered"`    |
| 4    | Change VAT Status to `SmallBusiness` |                                                 |
| 5    | Save                                 | Profile saves with `vatStatus: "SmallBusiness"` |

**Valid VatStatus values:** `NotRegistered`, `Registered`, `SmallBusiness`

### Test 1.5 — Only One Active Profile

| Step | Action                                                              | Expected Result                                                            |
| ---- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1    | With existing CH profile active, attempt to create a second profile | System should either: (a) update existing profile, or (b) prevent creation |
| 2    | ✅ Verify                                                           | Only ONE active profile exists at any time                                 |

**API verification:**

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/profile" -Headers $headers
# Should return exactly one profile object (not an array of multiple)
```

---

## 2. Tax Code Management (REQ-062)

**Requirement:** MWST/VAT tax codes must be configurable. Swiss standard rates are seeded.

**Frontend URL:** http://localhost:3000/finance/settings/tax-codes  
**API Base:** `http://localhost:5000/api/v1/finance/tax-codes`

### Test 2.1 — View Seeded Swiss Tax Codes

| Step | Action                                             | Expected Result      |
| ---- | -------------------------------------------------- | -------------------- |
| 1    | Navigate to `/finance/settings/tax-codes`          | Tax codes page loads |
| 2    | ✅ Verify seeded codes appear:                     |                      |
|      | `NORMAL` — 8.1% (Normalsatz)                       | ✅                   |
|      | `REDUCED` — 2.6% (Reduzierter Satz)                | ✅                   |
|      | `SPECIAL` — 3.8% (Sondersatz Beherbergung)         | ✅                   |
|      | `EXEMPT` — 0% (Befreit)                            | ✅                   |
| 3    | ✅ Verify each has code, label, and rate displayed |                      |

**API verification:**

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/tax-codes" -Headers $headers

# Expected: Array with 4 seeded tax codes
# [{ code: "NORMAL", rate: 8.1, label: "Normalsatz", ... }, ...]
```

### Test 2.2 — Create a Custom Tax Code

| Step | Action                                                       | Expected Result                           |
| ---- | ------------------------------------------------------------ | ----------------------------------------- |
| 1    | Click **Add Tax Code** (or equivalent button)                | Create form opens                         |
| 2    | Enter: Code=`CUSTOM10`, Label=`Custom 10% Test`, Rate=`10.0` |                                           |
| 3    | Click **Save**                                               | New tax code appears in list              |
| 4    | ✅ Verify                                                    | Code `CUSTOM10` appears with rate `10.0%` |

**API:**

```powershell
$body = @{ code = "CUSTOM10"; label = "Custom 10% Test"; rate = 10.0; isDefault = $false } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/tax-codes" -Method POST -Headers $headers -Body $body -ContentType "application/json"
```

### Test 2.3 — Edit a Tax Code

| Step | Action                               | Expected Result                     |
| ---- | ------------------------------------ | ----------------------------------- |
| 1    | Click edit on `CUSTOM10`             | Edit form opens with current values |
| 2    | Change Label to `Custom 10% Updated` |                                     |
| 3    | Save                                 | Label updates in the list           |
| 4    | ✅ Verify                            | New label displayed, rate unchanged |

**API:**

```powershell
# PUT /api/v1/finance/tax-codes/{id}
$body = @{ code = "CUSTOM10"; label = "Custom 10% Updated"; rate = 10.0; isDefault = $false } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/tax-codes/$taxCodeId" -Method PUT -Headers $headers -Body $body -ContentType "application/json"
```

### Test 2.4 — Delete (Soft-Delete) a Tax Code

| Step | Action                     | Expected Result                            |
| ---- | -------------------------- | ------------------------------------------ |
| 1    | Click delete on `CUSTOM10` | Confirmation dialog appears                |
| 2    | Confirm deletion           | Tax code disappears from list              |
| 3    | Refresh page               | `CUSTOM10` still not visible               |
| 4    | ✅ Verify                  | Deleted code no longer appears in GET list |

**API:**

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/tax-codes/$taxCodeId" -Method DELETE -Headers $headers
# Then verify GET returns only active codes
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/tax-codes" -Headers $headers
# CUSTOM10 should NOT appear
```

---

## 3. Invoice with VAT (REQ-062 + REQ-039)

**Requirement:** Invoices must support per-line tax codes, net/gross entry toggle, and correct tax calculations.

**Frontend URLs:**

- Invoice list: http://localhost:3000/finance/invoices
- New invoice: http://localhost:3000/finance/invoices/new
- Invoice detail: http://localhost:3000/finance/invoices/{id}

**API Base:** `http://localhost:5000/api/v1/finance/invoices`

### Test 3.1 — Create a New Invoice with Tax Codes

| Step | Action                                       | Expected Result                            |
| ---- | -------------------------------------------- | ------------------------------------------ |
| 1    | Navigate to `/finance/invoices/new`          | Invoice creation form loads                |
| 2    | Fill in header:                              |                                            |
|      | Recipient: select a member or enter external |                                            |
|      | Date: `2026-02-15`                           |                                            |
|      | Due Date: `2026-03-15`                       |                                            |
| 3    | Add Item 1:                                  |                                            |
|      | Description: `Membership Fee 2026`           |                                            |
|      | Quantity: `1`                                |                                            |
|      | Unit Price: `100.00`                         |                                            |
|      | Tax Code: `NORMAL (8.1%)`                    |                                            |
| 4    | Add Item 2:                                  |                                            |
|      | Description: `Event Ticket`                  |                                            |
|      | Quantity: `2`                                |                                            |
|      | Unit Price: `25.00`                          |                                            |
|      | Tax Code: `REDUCED (2.6%)`                   |                                            |
| 5    | ✅ Verify line totals                        | Item 1: Net 100.00, Tax 8.10, Gross 108.10 |
|      |                                              | Item 2: Net 50.00, Tax 1.30, Gross 51.30   |
| 6    | ✅ Verify invoice totals                     | Net: 150.00, Tax: 9.40, Gross: 159.40      |
| 7    | Click **Save**                               | Invoice saved in `Draft` status            |

### Test 3.2 — Net Entry vs Gross Entry Toggle

| Step | Action                                                       | Expected Result                            |
| ---- | ------------------------------------------------------------ | ------------------------------------------ |
| 1    | On the new invoice form, toggle **isGrossEntry** for an item |                                            |
| 2    | Enter Gross Price: `108.10`, Tax Code: `NORMAL (8.1%)`       |                                            |
| 3    | ✅ Verify                                                    | System calculates Net = 100.00, Tax = 8.10 |
| 4    | Toggle back to net entry                                     | Net = 100.00, Tax = 8.10, Gross = 108.10   |

### Test 3.3 — Send Invoice (Draft → Sent)

| Step | Action                                                                   | Expected Result      |
| ---- | ------------------------------------------------------------------------ | -------------------- |
| 1    | From invoice list, find the Draft invoice                                | Status shows `Draft` |
| 2    | Open the invoice, click **Senden** (Send)                                |                      |
| 3    | ✅ Verify status changes to `Sent`                                       |                      |
| 4    | ✅ Verify sent invoice displays correctly with all line items and totals |                      |

**API:**

```powershell
# POST /api/v1/finance/invoices/{id}/send
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/invoices/$invoiceId/send" -Method POST -Headers $headers

# Verify
$inv = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/invoices/$invoiceId" -Headers $headers
$inv.status  # Should be "Sent"
```

### Test 3.4 — Invoice with 0% Tax (Exempt)

| Step | Action                                            | Expected Result                       |
| ---- | ------------------------------------------------- | ------------------------------------- |
| 1    | Create a new invoice with Tax Code: `EXEMPT (0%)` |                                       |
| 2    | Unit Price: `200.00`, Qty: `1`                    |                                       |
| 3    | ✅ Verify                                         | Net: 200.00, Tax: 0.00, Gross: 200.00 |

---

## 4. Invoice PDF Generation (REQ-039)

**Requirement:** Sent invoices must generate a PDF with organization details, items, tax columns, and totals.

**API:** `GET /api/v1/finance/invoices/{id}/pdf`

### Test 4.1 — Download PDF for Sent Invoice

| Step | Action                                                  | Expected Result    |
| ---- | ------------------------------------------------------- | ------------------ |
| 1    | Open a **Sent** invoice at `/finance/invoices/{id}`     |                    |
| 2    | Click **PDF herunterladen** (Download PDF)              | PDF file downloads |
| 3    | Open the PDF and verify:                                |                    |
|      | ✅ Organization name and address (from Finance Profile) |                    |
|      | ✅ Recipient name and address                           |                    |
|      | ✅ Invoice number and dates                             |                    |
|      | ✅ Line items with Description, Qty, Unit Price         |                    |
|      | ✅ Tax Code and Tax Amount per line                     |                    |
|      | ✅ Subtotal, Total Tax, Grand Total                     |                    |
|      | ✅ IBAN / bank details                                  |                    |

**API:**

```powershell
# Download PDF
Invoke-WebRequest -Uri "http://localhost:5000/api/v1/finance/invoices/$invoiceId/pdf" -Headers $headers -OutFile "invoice.pdf"
# Open and inspect invoice.pdf
```

### Test 4.2 — Draft Invoice Cannot Generate PDF

| Step | Action                                        | Expected Result                   |
| ---- | --------------------------------------------- | --------------------------------- |
| 1    | Create a new invoice, leave in `Draft` status |                                   |
| 2    | Try to download PDF via API                   | Should return **400 Bad Request** |

**API:**

```powershell
try {
    Invoke-WebRequest -Uri "http://localhost:5000/api/v1/finance/invoices/$draftInvoiceId/pdf" -Headers $headers
} catch {
    $_.Exception.Response.StatusCode  # Expected: 400 (BadRequest)
}
```

---

## 5. Swiss QR-Bill (REQ-063)

**Requirement:** For CH-jurisdiction profiles with a valid IBAN, the invoice PDF must include a Swiss QR-bill payment slip.

### Prerequisites

- Finance Profile with `jurisdiction = CH`
- Valid Swiss IBAN (e.g., `CH93 0076 2011 6238 5295 7`)
- At least one **Sent** invoice

### Test 5.1 — QR-Bill on PDF

| Step | Action                                      | Expected Result                            |
| ---- | ------------------------------------------- | ------------------------------------------ |
| 1    | Ensure CH profile is active (see Section 1) |                                            |
| 2    | Open a **Sent** invoice                     |                                            |
| 3    | Download PDF                                |                                            |
| 4    | Scroll to last page                         | ✅ QR-bill payment slip (Zahlteil) visible |
| 5    | ✅ Verify QR code                           | Contains structured payment data           |
| 6    | ✅ Verify amount                            | Matches invoice grand total                |
| 7    | ✅ Verify currency                          | `CHF`                                      |
| 8    | ✅ Verify creditor info                     | Organization name and address from profile |
| 9    | ✅ Verify IBAN                              | Matches profile IBAN                       |

### Test 5.2 — QR Code Scanning

| Step | Action                                             | Expected Result |
| ---- | -------------------------------------------------- | --------------- |
| 1    | Use a QR reader app to scan the QR code on the PDF |                 |
| 2    | ✅ Verify decoded data contains:                   |                 |
|      | `SPC` header (Swiss Payment Code)                  |                 |
|      | IBAN                                               |                 |
|      | Creditor name and address                          |                 |
|      | Amount and currency                                |                 |
|      | Reference number (if applicable)                   |                 |

### Test 5.3 — No QR-Bill for Non-CH Profiles

| Step | Action                                         | Expected Result                      |
| ---- | ---------------------------------------------- | ------------------------------------ |
| 1    | Change profile jurisdiction to EU (e.g., `DE`) |                                      |
| 2    | Create and send a new invoice                  |                                      |
| 3    | Download PDF                                   |                                      |
| 4    | ✅ Verify                                      | QR-bill payment slip does NOT appear |

---

## 6. Receipt File Upload (REQ-061)

**Requirement:** Users can upload, download, attach, and soft-delete receipt files.

**Frontend URL:** http://localhost:3000/finance/receipts  
**API Base:** `http://localhost:5000/api/v1/finance/receipts`

### Test 6.1 — Upload a Receipt

| Step | Action                                       | Expected Result                                |
| ---- | -------------------------------------------- | ---------------------------------------------- |
| 1    | Navigate to `/finance/receipts`              | Receipts page loads                            |
| 2    | Click **Upload** or drag-drop a file         | File picker opens                              |
| 3    | Select a PDF file (e.g., `test-receipt.pdf`) |                                                |
| 4    | ✅ Verify                                    | File appears in list with filename, size, date |

**API:**

```powershell
# Upload via multipart/form-data
$filePath = "C:\path\to\test-receipt.pdf"
$form = @{ file = Get-Item $filePath }
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/receipts" -Method POST -Headers $headers -Form $form
```

### Test 6.2 — Upload Different File Types

| File Type     | Expected Result         |
| ------------- | ----------------------- |
| `receipt.pdf` | ✅ Uploads successfully |
| `receipt.jpg` | ✅ Uploads successfully |
| `receipt.png` | ✅ Uploads successfully |

### Test 6.3 — Download a Receipt

| Step | Action                                                          | Expected Result                                               |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| 1    | In the receipts list, click **Download** on an uploaded receipt | File downloads                                                |
| 2    | ✅ Verify                                                       | Downloaded file matches the original (same content, filename) |

**API:**

```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/v1/finance/receipts/$receiptId/download" -Headers $headers -OutFile "downloaded-receipt.pdf"
```

### Test 6.4 — Attach Receipt to a Transaction

| Step | Action                                          | Expected Result                    |
| ---- | ----------------------------------------------- | ---------------------------------- |
| 1    | Create a transaction at `/finance/transactions` | Transaction saved                  |
| 2    | Attach a receipt to the transaction             | Receipt linked                     |
| 3    | ✅ Verify                                       | Transaction shows attached receipt |

**API:**

```powershell
# POST /api/v1/finance/transactions/{transactionId}/receipt
$body = @{ receiptId = $receiptId } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/transactions/$transactionId/receipt" -Method POST -Headers $headers -Body $body -ContentType "application/json"
```

### Test 6.5 — Detach Receipt from Transaction

| Step | Action                                     | Expected Result                                 |
| ---- | ------------------------------------------ | ----------------------------------------------- |
| 1    | Open the transaction with attached receipt |                                                 |
| 2    | Click detach / remove receipt              |                                                 |
| 3    | ✅ Verify                                  | Receipt is unlinked; transaction has no receipt |

**API:**

```powershell
# DELETE /api/v1/finance/transactions/{transactionId}/receipt
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/transactions/$transactionId/receipt" -Method DELETE -Headers $headers
```

### Test 6.6 — Delete Receipt (Soft-Delete)

| Step | Action                    | Expected Result                                  |
| ---- | ------------------------- | ------------------------------------------------ |
| 1    | Click delete on a receipt | Confirmation dialog                              |
| 2    | Confirm                   | Receipt disappears from list                     |
| 3    | ✅ Verify via API         | `GET /receipts` does NOT include deleted receipt |

**API:**

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/receipts/$receiptId" -Method DELETE -Headers $headers
# Verify
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/receipts" -Headers $headers
# Deleted receipt not in list
```

---

## 7. Invoice Cancellation / Storno

**Requirement:** Sent or overdue invoices can be cancelled with a reason, creating a storno reversal transaction.

**API:** `POST /api/v1/finance/invoices/{id}/cancel`  
**Request Body:** `{ "reason": "...", "accountId": "..." }`

### Test 7.1 — Cancel a Sent Invoice

| Step | Action                                              | Expected Result                                           |
| ---- | --------------------------------------------------- | --------------------------------------------------------- |
| 1    | Create a new invoice, send it (Draft → Sent)        | Status: `Sent`                                            |
| 2    | Click **Stornieren** (Cancel)                       | Cancellation dialog opens                                 |
| 3    | Enter reason: `Customer requested cancellation`     |                                                           |
| 4    | Select account for storno transaction               |                                                           |
| 5    | Confirm                                             |                                                           |
| 6    | ✅ Verify invoice status → `Cancelled`              |                                                           |
| 7    | ✅ Verify cancellation reason is stored             |                                                           |
| 8    | ✅ Verify a storno reversal transaction was created | Check `/finance/transactions` for a negative-amount entry |

**API:**

```powershell
# Cancel invoice
$body = @{
    reason    = "Customer requested cancellation"
    accountId = $accountId
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/invoices/$invoiceId/cancel" -Method POST -Headers $headers -Body $body -ContentType "application/json"

# Verify status
$inv = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/invoices/$invoiceId" -Headers $headers
$inv.status  # Expected: "Cancelled"
```

### Test 7.2 — Cannot Cancel a Draft Invoice

| Step | Action                              | Expected Result     |
| ---- | ----------------------------------- | ------------------- |
| 1    | Create an invoice, leave as `Draft` |                     |
| 2    | Attempt to cancel via API           | **400 Bad Request** |

**API:**

```powershell
try {
    $body = @{ reason = "Test"; accountId = $accountId } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/invoices/$draftInvoiceId/cancel" -Method POST -Headers $headers -Body $body -ContentType "application/json"
} catch {
    $_.Exception.Response.StatusCode  # Expected: 400
}
```

### Test 7.3 — Cannot Cancel a Paid Invoice

| Step | Action                          | Expected Result                  |
| ---- | ------------------------------- | -------------------------------- |
| 1    | Find or create a `Paid` invoice |                                  |
| 2    | Attempt to cancel via API       | **400 Bad Request**              |
| 3    | ✅ Verify                       | Paid invoices cannot be stornoed |

---

## 8. Soft-Delete Verification

**Requirement:** All finance entities use soft-delete — records are marked as deleted but not physically removed.

### Test 8.1 — Soft-Delete an Account

| Step | Action                          | Expected Result                                                 |
| ---- | ------------------------------- | --------------------------------------------------------------- |
| 1    | Navigate to `/finance/accounts` | List of accounts                                                |
| 2    | Note the count of accounts      |                                                                 |
| 3    | Delete an account               | Account disappears from list                                    |
| 4    | Refresh the page                | Account still not visible                                       |
| 5    | ✅ Verify via API               | `GET /api/v1/finance/accounts` does NOT include deleted account |

**API:**

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/accounts/$accountId" -Method DELETE -Headers $headers
$accounts = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/accounts" -Headers $headers
# Deleted account should NOT be in list
```

### Test 8.2 — Soft-Delete Other Entity Types

Repeat the same pattern for each entity:

| Entity      | URL                           | API                                        |
| ----------- | ----------------------------- | ------------------------------------------ |
| Transaction | `/finance/transactions`       | `DELETE /api/v1/finance/transactions/{id}` |
| Category    | `/finance/categories`         | `DELETE /api/v1/finance/categories/{id}`   |
| Payment     | `/finance/payments`           | `DELETE /api/v1/finance/payments/{id}`     |
| Receipt     | `/finance/receipts`           | `DELETE /api/v1/finance/receipts/{id}`     |
| Tax Code    | `/finance/settings/tax-codes` | `DELETE /api/v1/finance/tax-codes/{id}`    |
| Invoice     | `/finance/invoices`           | `DELETE /api/v1/finance/invoices/{id}`     |

For each:

1. Create an entity
2. Delete it
3. ✅ Verify it disappears from the GET list
4. ✅ Verify the database record still exists (with a `DeletedAt` timestamp) — check via pgAdmin or `psql`

**Database verification (optional):**

```sql
-- Connect to PostgreSQL (localhost:5433, user: postgres, password: postgres, db: iabconnect)
SELECT "Id", "DeletedAt" FROM "Accounts" WHERE "Id" = '<account-id>';
-- DeletedAt should be non-null for soft-deleted records
```

---

## 9. VAT Summary Export

**Requirement:** Export a VAT/MWST summary CSV grouped by tax code for a given date range.

**Frontend URL:** http://localhost:3000/finance/exports  
**API:** `GET /api/v1/finance/exports/vat-summary?from={date}&to={date}`

### Test 9.1 — Prepare Test Data

| Step | Action                                                                 |
| ---- | ---------------------------------------------------------------------- |
| 1    | Ensure at least 3 invoices/transactions exist with different tax codes |
| 2    | Include: NORMAL (8.1%), REDUCED (2.6%), EXEMPT (0%)                    |
| 3    | Transactions should fall within a known date range                     |

### Test 9.2 — Export VAT Summary

| Step | Action                                                                      | Expected Result    |
| ---- | --------------------------------------------------------------------------- | ------------------ |
| 1    | Navigate to `/finance/exports`                                              | Exports page loads |
| 2    | Set date range: `2026-01-01` to `2026-12-31`                                |                    |
| 3    | Click **VAT Summary Export**                                                | CSV file downloads |
| 4    | Open CSV file                                                               |                    |
| 5    | ✅ Verify columns: Tax Code, Tax Rate, Net Amount, Tax Amount, Gross Amount |                    |
| 6    | ✅ Verify rows are grouped by tax code                                      |                    |
| 7    | ✅ Verify totals match the sum of individual transactions                   |                    |

**API:**

```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/v1/finance/exports/vat-summary?from=2026-01-01&to=2026-12-31" -Headers $headers -OutFile "vat-summary.csv"
# Open and inspect vat-summary.csv
```

### Test 9.3 — Other Export Types

| Export     | API                                                                 | Expected                  |
| ---------- | ------------------------------------------------------------------- | ------------------------- |
| Journal    | `GET /api/v1/finance/exports/journal?from=2026-01-01&to=2026-12-31` | CSV with all transactions |
| Open Items | `GET /api/v1/finance/exports/open-items`                            | CSV with unpaid invoices  |

---

## 10. Authorization Checks

**Requirement:** Finance module access is controlled by roles. `kassier` has full access, `auditor` has read-only, other roles have no access.

### 10.0 — Create Test Users (if not already done)

In Keycloak (http://localhost:8080, admin/admin):

1. **Create Kassier user:**
   - Username/Email: `kassier@iabconnect.ch`
   - Realm Role: `kassier`
   - Password: `Kassier-Dev-2026!`

2. **Create Auditor user:**
   - Username/Email: `auditor@iabconnect.ch`
   - Realm Role: `auditor`
   - Password: `Auditor-Dev-2026!`

### Test 10.1 — Auditor: Read-Only Access

| Step | Action                              | Expected Result                            |
| ---- | ----------------------------------- | ------------------------------------------ |
| 1    | Log in as `auditor@iabconnect.ch`   | Dashboard loads                            |
| 2    | Navigate to `/finance`              | Finance dashboard visible                  |
| 3    | Navigate to `/finance/accounts`     | ✅ Account list loads (read)               |
| 4    | Navigate to `/finance/transactions` | ✅ Transaction list loads (read)           |
| 5    | Navigate to `/finance/invoices`     | ✅ Invoice list loads (read)               |
| 6    | Try to create an account            | ❌ **403 Forbidden** or button not visible |
| 7    | Try to create a transaction         | ❌ **403 Forbidden** or button not visible |
| 8    | Try to create an invoice            | ❌ **403 Forbidden** or button not visible |
| 9    | Try to delete anything              | ❌ **403 Forbidden** or button not visible |

**API verification (with auditor token):**

```powershell
# Get auditor token
$body = @{
    grant_type    = "password"
    client_id     = "iabconnect-api"
    client_secret = "dev-secret-change-me"
    username      = "auditor@iabconnect.ch"
    password      = "Auditor-Dev-2026!"
}
$response = Invoke-RestMethod -Uri "http://localhost:8080/realms/iabconnect/protocol/openid-connect/token" -Method POST -Body $body
$AUDITOR_TOKEN = $response.access_token
$auditorHeaders = @{ Authorization = "Bearer $AUDITOR_TOKEN" }

# Read should succeed
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/accounts" -Headers $auditorHeaders
# Expected: 200 OK

# Write should fail
try {
    $body = @{ name = "Test Account"; type = "Income" } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/accounts" -Method POST -Headers $auditorHeaders -Body $body -ContentType "application/json"
} catch {
    $_.Exception.Response.StatusCode  # Expected: 403 (Forbidden)
}
```

### Test 10.2 — Kassier: Full Read+Write Access

| Step | Action                            | Expected Result                     |
| ---- | --------------------------------- | ----------------------------------- |
| 1    | Log in as `kassier@iabconnect.ch` | Dashboard loads                     |
| 2    | Navigate to `/finance`            | Finance dashboard visible           |
| 3    | Create an account                 | ✅ **201 Created**                  |
| 4    | Create a transaction              | ✅ **201 Created**                  |
| 5    | Create an invoice                 | ✅ **201 Created**                  |
| 6    | Edit an entity                    | ✅ **200 OK**                       |
| 7    | Delete an entity                  | ✅ **204 No Content** (soft-delete) |

**API verification (with kassier token):**

```powershell
# Get kassier token
$body = @{
    grant_type    = "password"
    client_id     = "iabconnect-api"
    client_secret = "dev-secret-change-me"
    username      = "kassier@iabconnect.ch"
    password      = "Kassier-Dev-2026!"
}
$response = Invoke-RestMethod -Uri "http://localhost:8080/realms/iabconnect/protocol/openid-connect/token" -Method POST -Body $body
$KASSIER_TOKEN = $response.access_token
$kassierHeaders = @{ Authorization = "Bearer $KASSIER_TOKEN" }

# Read
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/accounts" -Headers $kassierHeaders
# Expected: 200 OK

# Write (create account)
$body = @{ name = "Kassier Test Account"; type = "Income" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/accounts" -Method POST -Headers $kassierHeaders -Body $body -ContentType "application/json"
# Expected: 201 Created
```

### Test 10.3 — Unauthorized Roles (vorstand, member)

| Step | Action                                   | Expected Result                       |
| ---- | ---------------------------------------- | ------------------------------------- |
| 1    | Log in as `vorstand@iabconnect.ch`       | Dashboard loads                       |
| 2    | ✅ Verify                                | Finance module NOT visible in sidebar |
| 3    | Navigate directly to `/finance`          | ❌ Redirected or access denied        |
| 4    | Call API: `GET /api/v1/finance/accounts` | ❌ **403 Forbidden**                  |

```powershell
# Get vorstand token
$body = @{
    grant_type    = "password"
    client_id     = "iabconnect-api"
    client_secret = "dev-secret-change-me"
    username      = "vorstand@iabconnect.ch"
    password      = "Vorstand-Dev-2026!"
}
$response = Invoke-RestMethod -Uri "http://localhost:8080/realms/iabconnect/protocol/openid-connect/token" -Method POST -Body $body
$VORSTAND_TOKEN = $response.access_token

try {
    Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/accounts" -Headers @{ Authorization = "Bearer $VORSTAND_TOKEN" }
} catch {
    $_.Exception.Response.StatusCode  # Expected: 403
}
```

### Test 10.4 — Unauthenticated Access

| Step | Action                               | Expected Result         |
| ---- | ------------------------------------ | ----------------------- |
| 1    | Call any finance API without a token | ❌ **401 Unauthorized** |

```powershell
try {
    Invoke-RestMethod -Uri "http://localhost:5000/api/v1/finance/accounts"
} catch {
    $_.Exception.Response.StatusCode  # Expected: 401
}
```

---

## Quick Reference — API Endpoints

| Endpoint                                    | Method | Auth Policy  | Description                |
| ------------------------------------------- | ------ | ------------ | -------------------------- |
| `/api/v1/finance/profile`                   | GET    | FinanceRead  | Get active finance profile |
| `/api/v1/finance/profile`                   | POST   | FinanceWrite | Create finance profile     |
| `/api/v1/finance/profile/{id}`              | PUT    | FinanceWrite | Update finance profile     |
| `/api/v1/finance/tax-codes`                 | GET    | FinanceRead  | List all tax codes         |
| `/api/v1/finance/tax-codes`                 | POST   | FinanceWrite | Create tax code            |
| `/api/v1/finance/tax-codes/{id}`            | PUT    | FinanceWrite | Update tax code            |
| `/api/v1/finance/tax-codes/{id}`            | DELETE | FinanceWrite | Soft-delete tax code       |
| `/api/v1/finance/invoices`                  | GET    | FinanceRead  | List invoices              |
| `/api/v1/finance/invoices/open`             | GET    | FinanceRead  | List open items            |
| `/api/v1/finance/invoices/{id}`             | GET    | FinanceRead  | Get invoice by ID          |
| `/api/v1/finance/invoices`                  | POST   | FinanceWrite | Create invoice             |
| `/api/v1/finance/invoices/{id}`             | PUT    | FinanceWrite | Update invoice             |
| `/api/v1/finance/invoices/{id}`             | DELETE | FinanceWrite | Soft-delete invoice        |
| `/api/v1/finance/invoices/{id}/send`        | POST   | FinanceWrite | Mark invoice as sent       |
| `/api/v1/finance/invoices/{id}/cancel`      | POST   | FinanceWrite | Cancel (storno) invoice    |
| `/api/v1/finance/invoices/{id}/pdf`         | GET    | FinanceRead  | Download invoice PDF       |
| `/api/v1/finance/accounts`                  | GET    | FinanceRead  | List accounts              |
| `/api/v1/finance/accounts`                  | POST   | FinanceWrite | Create account             |
| `/api/v1/finance/accounts/{id}`             | PUT    | FinanceWrite | Update account             |
| `/api/v1/finance/accounts/{id}`             | DELETE | FinanceWrite | Soft-delete account        |
| `/api/v1/finance/transactions`              | GET    | FinanceRead  | List transactions          |
| `/api/v1/finance/transactions/summary`      | GET    | FinanceRead  | Get summary                |
| `/api/v1/finance/transactions/{id}`         | GET    | FinanceRead  | Get by ID                  |
| `/api/v1/finance/transactions`              | POST   | FinanceWrite | Create transaction         |
| `/api/v1/finance/transactions/{id}`         | PUT    | FinanceWrite | Update transaction         |
| `/api/v1/finance/transactions/{id}`         | DELETE | FinanceWrite | Soft-delete                |
| `/api/v1/finance/transactions/{id}/receipt` | POST   | FinanceWrite | Attach receipt             |
| `/api/v1/finance/transactions/{id}/receipt` | DELETE | FinanceWrite | Detach receipt             |
| `/api/v1/finance/payments`                  | GET    | FinanceRead  | List payments              |
| `/api/v1/finance/payments`                  | POST   | FinanceWrite | Create payment             |
| `/api/v1/finance/payments/{id}`             | PUT    | FinanceWrite | Update payment             |
| `/api/v1/finance/payments/{id}`             | DELETE | FinanceWrite | Soft-delete                |
| `/api/v1/finance/categories`                | GET    | FinanceRead  | List categories            |
| `/api/v1/finance/categories`                | POST   | FinanceWrite | Create category            |
| `/api/v1/finance/categories/{id}`           | PUT    | FinanceWrite | Update category            |
| `/api/v1/finance/categories/{id}`           | DELETE | FinanceWrite | Soft-delete                |
| `/api/v1/finance/receipts`                  | GET    | FinanceRead  | List receipts              |
| `/api/v1/finance/receipts`                  | POST   | FinanceWrite | Upload receipt             |
| `/api/v1/finance/receipts/{id}`             | GET    | FinanceRead  | Get receipt metadata       |
| `/api/v1/finance/receipts/{id}/download`    | GET    | FinanceRead  | Download receipt file      |
| `/api/v1/finance/receipts/{id}`             | DELETE | FinanceWrite | Soft-delete                |
| `/api/v1/finance/exports/journal`           | GET    | FinanceRead  | Export journal CSV         |
| `/api/v1/finance/exports/open-items`        | GET    | FinanceRead  | Export open items CSV      |
| `/api/v1/finance/exports/vat-summary`       | GET    | FinanceRead  | Export VAT summary CSV     |

---

## Quick Reference — Frontend Routes

| Route                         | Page                                             |
| ----------------------------- | ------------------------------------------------ |
| `/finance`                    | Finance Dashboard                                |
| `/finance/accounts`           | Accounts List                                    |
| `/finance/categories`         | Categories List                                  |
| `/finance/transactions`       | Transactions List                                |
| `/finance/invoices`           | Invoices List                                    |
| `/finance/invoices/new`       | Create New Invoice                               |
| `/finance/invoices/{id}`      | Invoice Detail / Edit                            |
| `/finance/payments`           | Payments List                                    |
| `/finance/receipts`           | Receipts Upload & List                           |
| `/finance/exports`            | Export Center (Journal, Open Items, VAT Summary) |
| `/finance/settings`           | Finance Profile Settings (REQ-060)               |
| `/finance/settings/tax-codes` | Tax Code Management (REQ-062)                    |
| `/finance/bank-import`        | Bank Statement Import                            |
| `/finance/dunning`            | Dunning Notices                                  |

---

## Teardown

After testing, stop all services:

```powershell
# Stop frontend: Ctrl+C in frontend terminal
# Stop backend: Ctrl+C in backend terminal

# Stop Docker infrastructure
cd b:\Projects\IAB Connect\iab-connect\infra
docker compose down

# Optional: remove volumes (DESTROYS ALL DATA)
docker compose down -v
```

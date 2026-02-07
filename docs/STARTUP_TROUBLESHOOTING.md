# IAB Connect - Startup Troubleshooting Guide

Comprehensive guide for starting the IAB Connect application and resolving common startup issues.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Common Issues & Solutions](#common-issues--solutions)
- [Step-by-Step Startup Process](#step-by-step-startup-process)
- [Health Check Verification](#health-check-verification)
- [Debugging & Troubleshooting](#debugging--troubleshooting)

---

## Prerequisites

Before starting the application, ensure you have the following installed:

### Required Software
- **Docker Desktop** (with Docker Compose) - https://www.docker.com/products/docker-desktop
- **.NET SDK 10.0** - https://dotnet.microsoft.com/download
- **Node.js 20+** - https://nodejs.org/
- **Git** - https://git-scm.com/

### Environment Setup
- Clone the repository: `git clone https://github.com/htos/iab-connect.git`
- Navigate to project root: `cd iab-connect`
- Docker must be running and accessible from command line

### Network Ports Required
- **3000** - Frontend (Next.js)
- **5000** - Backend API (.NET Core)
- **5433** - PostgreSQL
- **6379** - Redis (if configured)
- **8080** - Keycloak
- **9000** - MinIO S3 Storage
- **1025/1080** - MailHog (Email testing)
- **5341** - Seq (Logging)

---

## Quick Start

### Recommended: Use Startup Scripts

The easiest way to start the application is using the provided startup scripts:

```bash
# Start everything (Docker + Backend + Frontend)
.\start-all.bat

# Or start only the backend
.\start-backend.bat
```

### Manual Start

For experienced developers who want to start services individually:

```bash
# 1. Navigate to project root
cd b:\Projects\IAB Connect\iab-connect

# 2. Stop any lingering services (especially PostgreSQL)
net stop postgresql-x64-17

# 3. Start Docker containers
docker-compose -f infra/docker-compose.yml up -d

# 4. Wait 15-20 seconds for services to initialize

# 5. Run backend migrations
cd backend
dotnet ef database update --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api

# 6. Start backend (IMPORTANT: Set ASPNETCORE_ENVIRONMENT!)
cd src/IabConnect.Api
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run

# 7. In new terminal, start frontend
cd frontend
npm install  # Only if dependencies changed
npm run dev

# 8. Access application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Keycloak Admin: http://localhost:8080 (admin/admin)
```

> ⚠️ **CRITICAL**: Always set `ASPNETCORE_ENVIRONMENT=Development` before running the backend!
> Without this, the backend runs in Production mode and uses wrong Keycloak credentials.

---

## Common Issues & Solutions

### Issue 1: PostgreSQL Port 5433 Already in Use

**Problem:** Docker fails to start PostgreSQL container with message like:
```
Error response from daemon: Ports are not available: exposing port TCP 0.0.0.0:5433 -> 0.0.0.0:5433
```

**Root Cause:** Windows PostgreSQL service running locally, blocking Docker container.

**Solution:**
```powershell
# Check if service is running
Get-Service postgresql-x64-17 | Select-Object Status

# Stop the service
net stop postgresql-x64-17

# Restart Docker containers
docker-compose -f infra/docker-compose.yml down
docker-compose -f infra/docker-compose.yml up -d
```

**Prevention:** Set PostgreSQL service to Manual startup:
```powershell
Set-Service -Name postgresql-x64-17 -StartupType Manual
```

---

### Issue 2: Keycloak 403 Forbidden Error

**Problem:** Backend logs show authentication failures:
```
[403] POST http://localhost:8080/realms/iabconnect/protocol/openid-connect/token - 403 Forbidden
```

**Root Cause:** 
- Incorrect client secret in configuration
- Missing service account roles
- Mismatched Keycloak realm

**Solution:**

**Step A: Verify Client Secret**
1. Check `appsettings.Development.json`:
```json
"Keycloak": {
  "ServerUrl": "http://localhost:8080",
  "Realm": "iabconnect",
  "AdminClient": "admin-service",
  "AdminClientSecret": "admin-service-secret-2026"  // ← Must match!
}
```

2. Login to Keycloak Admin Console:
   - URL: http://localhost:8080
   - Username: admin
   - Password: admin

3. Navigate: Clients → iabconnect-admin → Credentials → Copy "Client Secret"

4. Update `appsettings.Development.json` if different

**Step B: Verify Service Account Roles**
1. In Keycloak Admin Console:
   - Go to Clients → iabconnect-admin → Service Account Roles
   - Ensure "realm-admin" role is assigned
   - If missing: Available Roles → realm-management → realm-admin → Add selected

2. Restart backend:
```bash
# Ctrl+C to stop current process
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run
```

**Step C: Fresh Realm Import (if still failing)**
```bash
# Delete existing realm data (⚠️ WARNING: Deletes all users/settings)
docker-compose -f infra/docker-compose.yml down -v

# Restart containers (realm will auto-import)
docker-compose -f infra/docker-compose.yml up -d

# Wait 30 seconds for Keycloak to initialize
```

---

### Issue 3: Database Relation Errors

**Problem:** Database errors like:
```
ERROR 42P01: relation "events" does not exist
ERROR 42P01: relation "email_campaigns" does not exist
```

**Root Cause:** Database migrations not applied after container startup.

**Solution:**
```bash
cd backend

# Apply all pending migrations
dotnet ef database update \
  --project src/IabConnect.Infrastructure \
  --startup-project src/IabConnect.Api

# Verify migration applied:
# ✓ If successful, no errors displayed
# ✓ Output shows "Done" message
```

**Verify Migrations Applied:**
```bash
# Connect to PostgreSQL container
docker exec -it iab-postgres psql -U postgres -d iabconnect

# List all tables
\dt

# Should show tables: events, email_campaigns, email_recipients, members, etc.
# Exit: \q
```

---

### Issue 4: Missing Translation Keys (Frontend)

**Problem:** Browser console shows errors:
```
[next-intl] Missing message: "events.form.basicInfoDescription"
[next-intl] Missing message: "events.form.dateTimeDescription"
```

**Root Cause:** Translation keys added to code but not in JSON files.

**Solution:**

1. **Identify Missing Keys:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for `[next-intl] Missing message:` errors

2. **Add Missing Keys:**
   - German translations: `frontend/messages/de.json`
   - English translations: `frontend/messages/en.json`

3. **Example Fix:**
```json
{
  "events": {
    "form": {
      "basicInfoDescription": "Geben Sie grundlegende Informationen über das Event ein",
      "dateTimeDescription": "Wählen Sie Startzeit und Endzeit für das Event",
      "locationSection": "Veranstaltungsort",
      "locationDescription": "Geben Sie den Ort des Events an",
      "costSection": "Kosten",
      "costDescriptionLabel": "Kostenbeschreibung",
      "costDescriptionPlaceholder": "z.B. Einschließlich Essen und Getränke"
    }
  }
}
```

4. **Verify Fix:**
   - Refresh browser
   - Console should no longer show missing message errors

---

### Issue 5: Backend Running in Production Mode (Keycloak 401 Errors)

**Problem:** Backend logs show 401 errors when requesting Keycloak tokens:
```
[23:20:59 INF] Received HTTP response headers after 7.5251ms - 401
[23:20:59 ERR] HTTP GET /api/v1/users responded 500 in 38.1912 ms
```

And you see `Environment: Production` in the startup logs instead of `Environment: Development`.

**Root Cause:** The `ASPNETCORE_ENVIRONMENT` variable is not set, so .NET defaults to Production mode and loads `appsettings.json` instead of `appsettings.Development.json` (which has the correct Keycloak credentials).

**Solution:**

**Option 1: Use Startup Scripts (Recommended)**
```bash
# Use the provided startup scripts that set the environment automatically
.\start-backend.bat     # Start only backend
.\start-all.bat         # Start everything
```

**Option 2: Set Environment Variable Manually**
```powershell
# In PowerShell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run
```

```bash
# In bash/Git Bash
export ASPNETCORE_ENVIRONMENT=Development
dotnet run
```

**Option 3: Use Launch Profile**
```bash
dotnet run --launch-profile Development
```

**Verify Correct Environment:**
Check the backend logs for:
```
[INF] Environment: Development     ✅ Correct
[INF] Hosting environment: Development
```

NOT:
```
[INF] Environment: Production      ❌ Wrong!
```

---

### Issue 6: Port Already in Use

**Problem:** Cannot start services due to port conflicts:
```
Error: listen EADDRINUSE: address already in use :::3000
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**

```powershell
# Find process using port
netstat -ano | findstr :3000
netstat -ano | findstr :5000

# Kill process by PID (example: PID 1234)
taskkill /PID 1234 /F

# Or: Stop all node processes
Get-Process node | Stop-Process -Force
```

**Restart the service:**
```bash
npm run dev      # Frontend
# or
dotnet run       # Backend
```

---

### Issue 6: Docker Containers Keep Restarting

**Problem:** Docker container exits immediately after starting:
```
Container exited with code 1
```

**Solution:**

1. **Check container logs:**
```bash
docker-compose -f infra/docker-compose.yml logs -f postgres
docker-compose -f infra/docker-compose.yml logs -f keycloak
docker-compose -f infra/docker-compose.yml logs -f mailhog
```

2. **Common causes:**
   - Port already in use → Kill process (see Issue 5)
   - Insufficient disk space → Free up disk
   - Docker daemon not running → Start Docker Desktop
   - Volume permission issues → Check folder permissions

3. **Nuclear option (⚠️ deletes all data):**
```bash
docker-compose -f infra/docker-compose.yml down -v
docker-compose -f infra/docker-compose.yml up -d
```

---

## Step-by-Step Startup Process

Follow this process sequentially if application won't start:

### Phase 1: Infrastructure Setup (5 minutes)

**Step 1.1: Stop Conflicting Services**
```powershell
# Stop local PostgreSQL if installed
net stop postgresql-x64-17

# Verify it's stopped
Get-Service postgresql-x64-17 | Select-Object Status
```

**Step 1.2: Start Docker Containers**
```bash
cd b:\Projects\IAB Connect\iab-connect
docker-compose -f infra/docker-compose.yml up -d
```

**Step 1.3: Verify Containers Starting**
```bash
# Check container status (should be "Up")
docker-compose -f infra/docker-compose.yml ps

# Monitor startup logs
docker-compose -f infra/docker-compose.yml logs -f
```

**Wait indicators:**
- Keycloak: "Admin console listening on..." message
- PostgreSQL: "database system is ready..." message
- Wait 20-30 seconds total before proceeding

### Phase 2: Database Setup (3 minutes)

**Step 2.1: Apply Migrations**
```bash
cd backend

dotnet ef database update \
  --project src/IabConnect.Infrastructure \
  --startup-project src/IabConnect.Api
```

**Expected output:**
```
Build started...
Build succeeded.
Applying migration '20260203210937_PendingChanges'.
Done.
```

### Phase 3: Backend Startup (2 minutes)

**Step 3.1: Start Backend API**
```bash
cd backend/src/IabConnect.Api
dotnet run
```

**Wait for indicators:**
- "Hangfire Server started"
- "Application started. Press Ctrl+C to shut down"
- "Listening on: http://localhost:5000"

### Phase 4: Frontend Startup (2 minutes)

**Step 4.1: Open New Terminal**
```bash
cd frontend
npm install  # Only if node_modules missing or package.json changed
npm run dev
```

**Wait for indicators:**
- "Ready in X.XXs"
- "Local: http://localhost:3000"

### Phase 5: Verification (2 minutes)

**Step 5.1: Verify Backend Health**
```bash
# In PowerShell
Invoke-WebRequest -Uri http://localhost:5000/health
# Should return 200 OK response
```

**Step 5.2: Verify Frontend Loads**
```bash
# Open browser
http://localhost:3000

# Should load without errors
# Check browser console (F12) for errors
```

**Step 5.3: Login Test**
```
Credentials:
- Email: admin@iabconnect.ch
- Password: Admin-Dev-2026!
```

---

## Health Check Verification

### Backend Health Endpoints

```bash
# Basic health check
curl http://localhost:5000/health

# Detailed health status
curl http://localhost:5000/health/detailed
```

**Expected responses:**
- Status: 200 OK
- Body: `{"status":"Healthy"}`

### Database Connectivity

```bash
# Backend logs should show successful database queries
# Look for messages like: "Executed DbCommand (Xms)"
# WITHOUT error messages like "relation does not exist"
```

### Keycloak Connectivity

```bash
# Backend logs should show:
# "Obtained new Keycloak admin token, expires at ..."
```

### Frontend Asset Loading

```
Browser DevTools → Network tab:
- All images/CSS/JS should load (Status: 200)
- No 404 errors for assets
- No CORS errors
```

---

## Debugging & Troubleshooting

### Enable Verbose Logging

**Backend (.NET Core):**
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft": "Information",
      "System": "Warning"
    }
  }
}
```

**Frontend (Next.js):**
```bash
# Run with debug output
set DEBUG=* && npm run dev

# Or on Windows PowerShell
$env:DEBUG="*"; npm run dev
```

### Access Container Terminals

```bash
# Access PostgreSQL
docker exec -it iab-postgres psql -U postgres -d iabconnect

# List tables
\dt

# Query specific table
SELECT * FROM events LIMIT 5;

# Exit
\q
```

### View Container Logs

```bash
# All containers
docker-compose -f infra/docker-compose.yml logs -f

# Specific service
docker-compose -f infra/docker-compose.yml logs -f postgres
docker-compose -f infra/docker-compose.yml logs -f keycloak
docker-compose -f infra/docker-compose.yml logs -f mailhog

# Follow logs (live updates)
# Press Ctrl+C to exit
```

### Reset to Clean State

**⚠️ WARNING: This deletes all data**

```bash
# Stop all containers
docker-compose -f infra/docker-compose.yml down

# Remove volumes (delete data)
docker-compose -f infra/docker-compose.yml down -v

# Remove images (rebuild from scratch)
docker-compose -f infra/docker-compose.yml down -v --rmi all

# Clean up node_modules and dependencies
cd frontend && rm -r node_modules
cd backend && dotnet clean

# Start fresh
docker-compose -f infra/docker-compose.yml up -d
npm install && npm run dev
dotnet run
```

---

## Quick Reference Commands

```bash
# View running containers
docker-compose -f infra/docker-compose.yml ps

# View container logs
docker-compose -f infra/docker-compose.yml logs -f [service-name]

# Restart service
docker-compose -f infra/docker-compose.yml restart [service-name]

# Access PostgreSQL
docker exec -it iab-postgres psql -U postgres -d iabconnect

# Apply database migrations
cd backend
dotnet ef database update --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api

# Run backend
cd backend/src/IabConnect.Api
dotnet run

# Run frontend
cd frontend
npm run dev

# Kill process on port
lsof -ti:3000 | xargs kill -9  # macOS/Linux
taskkill /F /PID [PID]         # Windows
```

---

## Support & Additional Resources

- **Project Documentation:** See `docs/` folder
- **Architecture:** `docs/02_architecture.md`
- **API Contracts:** `docs/03_api_contracts.md`
- **Security & Privacy:** `docs/05_security_privacy.md`
- **Development Workflow:** `docs/06_dev_workflow.md`
- **Stack Versions:** `docs/12_stack_versions.md`

---

## Last Updated

**Date:** February 3, 2026  
**Last Modified By:** Development Team  
**Version:** 1.0

---

**Need Help?**
1. Check this guide thoroughly
2. Review logs in `backend/bin/Debug/net10.0/` and frontend terminal
3. Check GitHub Issues for similar problems
4. Contact development team with:
   - Error messages from logs
   - Output of `docker-compose ps`
   - Output of `dotnet ef migrations list`
   - Browser console errors (F12)

@echo off
REM ============================================
REM IAB Connect - Full Stack Development Startup
REM ============================================
REM This script starts all services needed for development

echo ============================================
echo IAB Connect - Full Development Environment
echo ============================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Start infrastructure
echo [1/3] Starting Docker infrastructure...
cd /d "%~dp0infra"
docker-compose up -d
echo      Waiting for services to be ready...
timeout /t 15 /nobreak >nul

REM Start backend
echo.
echo [2/3] Starting Backend API...
set ASPNETCORE_ENVIRONMENT=Development
start "IAB Connect Backend" cmd /k "cd /d %~dp0backend\src\IabConnect.Api && dotnet run"

REM Start frontend
echo.
echo [3/3] Starting Frontend...
start "IAB Connect Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================
echo All services started!
echo ============================================
echo.
echo Services:
echo   - Backend API:    http://localhost:5000
echo   - Frontend:       http://localhost:3000
echo   - Keycloak:       http://localhost:8080
echo   - PostgreSQL:     localhost:5433
echo   - MailHog:        http://localhost:8025
echo   - RustFS Console: http://localhost:9001
echo   - Seq Logs:       http://localhost:5341
echo.
echo Test Users:
echo   - admin@iabconnect.ch    / Admin-Dev-2026!
echo   - vorstand@iabconnect.ch / Vorstand-Dev-2026!
echo   - member@iabconnect.ch   / Member-Dev-2026!
echo.
pause

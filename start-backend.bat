@echo off
REM ============================================
REM IAB Connect Backend - Development Startup
REM ============================================
REM This script ensures the backend runs in Development mode

echo Starting IAB Connect Backend in Development mode...
echo.

REM Set environment variable
set ASPNETCORE_ENVIRONMENT=Development

REM Navigate to API project
cd /d "%~dp0backend\src\IabConnect.Api"

REM Run the application
dotnet run

pause

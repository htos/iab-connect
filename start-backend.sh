#!/bin/bash
# ============================================
# IAB Connect Backend - Development Startup
# ============================================
# This script ensures the backend runs in Development mode

echo "Starting IAB Connect Backend in Development mode..."
echo

# Set environment variable
export ASPNETCORE_ENVIRONMENT=Development

# Navigate to API project
cd "$(dirname "$0")/backend/src/IabConnect.Api"

# Run the application
dotnet run

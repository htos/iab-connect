@echo off
REM Build the Keycloak SPI for disabling new users
REM Requires Maven and Java 17+

cd /d "%~dp0keycloak\providers\disable-new-users"
call mvn clean package -DskipTests
echo.
echo Build complete! JAR file at: keycloak\providers\disable-new-users\target\disable-new-users-spi-1.0.0.jar
echo Restart Keycloak to load the new provider: docker compose restart keycloak

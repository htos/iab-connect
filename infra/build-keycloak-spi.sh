#!/bin/bash
# Build the Keycloak SPI for disabling new users
# Requires Maven and Java 17+

cd "$(dirname "$0")/keycloak/providers/disable-new-users"
mvn clean package -DskipTests
echo ""
echo "Build complete! JAR file at: keycloak/providers/disable-new-users/target/disable-new-users-spi-1.0.0.jar"
echo "Restart Keycloak to load the new provider: docker compose restart keycloak"

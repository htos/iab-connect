# syntax=docker/dockerfile:1.7
#
# Custom Keycloak image for IAB Connect Beta deployment.
# Bakes the disable-new-users SPI + sanitized iabconnect realm so Railway can
# run `kc.sh start --optimized` with no runtime file mounts. See ADR-016.

# ---- spi-build stage --------------------------------------------------------
FROM maven:3.9-eclipse-temurin-17 AS spi-build
WORKDIR /build

COPY providers/disable-new-users/pom.xml .
RUN mvn -B dependency:go-offline

COPY providers/disable-new-users/src ./src
RUN mvn -B clean package -DskipTests

RUN test -f /build/target/disable-new-users-spi-1.0.0.jar

# ---- kc-final stage ---------------------------------------------------------
FROM quay.io/keycloak/keycloak:26.5.2 AS kc-final

LABEL org.opencontainers.image.source="https://github.com/htos/iab-connect" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.title="IAB Connect Keycloak" \
      org.opencontainers.image.description="Keycloak with disable-new-users SPI + iabconnect realm pre-imported. AGPL-3.0-or-later." \
      org.opencontainers.image.vendor="IAB Connect contributors"

COPY --from=spi-build /build/target/disable-new-users-spi-1.0.0.jar /opt/keycloak/providers/disable-new-users-spi.jar

COPY realms-beta/iabconnect-realm.json /opt/keycloak/data/import/iabconnect-realm.json

# KC_DB is a BUILD-TIME-FROZEN option in --optimized mode (Quarkus augments
# classes per driver). Default to 'postgres' (matches E13-S2 Beta runtime);
# override at build time for local smoke tests:
#   docker build --build-arg KC_DB=dev-file -t iabc-keycloak:smoke infra/keycloak/
ARG KC_DB=postgres
ENV KC_DB=${KC_DB}

# NOTE: --features= is for built-in Keycloak features (token-exchange, etc.),
# NOT for SPI provider IDs. Custom event-listener providers in
# /opt/keycloak/providers/ are auto-discovered at build time. See story
# Question #4 — first build attempt failed with "'disable-new-users' is an
# unrecognized feature" exactly per the documented workaround branch.
RUN /opt/keycloak/bin/kc.sh build

CMD ["start", "--optimized"]

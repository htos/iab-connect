# Build the Keycloak SPI
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /build
COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

# Just copy the JAR to output
FROM scratch AS export
COPY --from=builder /build/target/disable-new-users-spi-1.0.0.jar /

# syntax=docker/dockerfile:1.7

ARG DOTNET_SDK_TAG=10.0
ARG DOTNET_RUNTIME_TAG=10.0

# ---- build stage ------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_SDK_TAG} AS build
WORKDIR /src

# Copy solution-level files first for layer caching on dep restore.
COPY ["Directory.Build.props", "Directory.Packages.props", "global.json", "./"]

# Copy .csproj files only (not source) so dotnet restore caches across source edits.
COPY ["src/IabConnect.Api/IabConnect.Api.csproj",                        "src/IabConnect.Api/"]
COPY ["src/IabConnect.Application/IabConnect.Application.csproj",       "src/IabConnect.Application/"]
COPY ["src/IabConnect.Domain/IabConnect.Domain.csproj",                 "src/IabConnect.Domain/"]
COPY ["src/IabConnect.Infrastructure/IabConnect.Infrastructure.csproj", "src/IabConnect.Infrastructure/"]
RUN dotnet restore "src/IabConnect.Api/IabConnect.Api.csproj"

# Copy full source and publish.
# PublishSingleFile=false overrides the Release-config default in
# Directory.Build.props:14, which would otherwise emit a single-file IabConnect.Api
# host binary incompatible with `ENTRYPOINT ["dotnet", "IabConnect.Api.dll"]`.
COPY src/ src/
RUN dotnet publish "src/IabConnect.Api/IabConnect.Api.csproj" \
      -c Release \
      -o /app/publish \
      /p:UseAppHost=false \
      /p:PublishSingleFile=false

# ---- runtime stage ----------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_RUNTIME_TAG} AS runtime

ARG BUILD_SHA=unknown
ARG BUILD_DATE=unknown
ENV BUILD_SHA=$BUILD_SHA \
    BUILD_DATE=$BUILD_DATE \
    ASPNETCORE_URLS=http://+:8080 \
    TZ=Europe/Zurich \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

# OCI labels for GHCR provenance (ADR-014, ADR-009). Per-build labels (revision, created)
# are injected at `docker buildx build --label …` time by E20-S5 CI.
LABEL org.opencontainers.image.source="https://github.com/htos/iab-connect" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.title="IAB Connect API" \
      org.opencontainers.image.description="Backend API for IAB Connect — AGPL-3.0-or-later open-source membership platform." \
      org.opencontainers.image.vendor="IAB Connect contributors"

# Install tzdata + curl so Europe/Zurich resolves and HEALTHCHECK can run.
# aspnet:10.0 Ubuntu Noble base ships tzdata + ICU pre-bundled (~14B no-op);
# curl is needed for the HEALTHCHECK declared below. All in one RUN to
# minimize layers; cleanup apt lists.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata curl \
    && rm -rf /var/lib/apt/lists/* \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

WORKDIR /app
# Use the pre-created `app` user shipped by mcr.microsoft.com/dotnet/aspnet:10.0
# (UID = $APP_UID = 1654 on Ubuntu Noble base). The base creates the user with
# /home/app, /etc/passwd entry, and a usable login shell — required by ASP.NET
# DataProtection (writes keyring to /home/$USER) and any feature that opens a
# temp file under /tmp or writes logs.
COPY --from=build --chown=app:app /app/publish ./

USER $APP_UID

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8080/health/ready || exit 1

ENTRYPOINT ["dotnet", "IabConnect.Api.dll"]

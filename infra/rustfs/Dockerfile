# syntax=docker/dockerfile:1.7
#
# Custom RustFS image for the IAB Connect Beta on Railway.
#
# The upstream rustfs/rustfs image runs as the non-root user `rustfs` (see its
# entrypoint: it `exec`s the binary with no privilege handling). Railway mounts
# the persistent volume at /data owned by root, so the rustfs process cannot
# write to it and crashes at startup with "Permission denied (os error 13)".
# Railway provides no per-service USER override for image deploys, so we run the
# process as root here — root can write to the root-owned volume mount.
#
# Beta-acceptable. Production hardening path: a chown-and-drop entrypoint
# (chown /data + /logs to the rustfs uid as root, then su-exec to rustfs).
#
# Pinned to the digest captured during E13 Beta bring-up (rustfs/rustfs:latest
# @ 2026-06-16) per ADR-014 (digest-pinned images). Re-pin on intentional upgrade.
FROM rustfs/rustfs@sha256:fa19210ac4697c79d7ccca1ec9b0eb91aebacc6691991ffb14014bb3c67e6cc3
USER root

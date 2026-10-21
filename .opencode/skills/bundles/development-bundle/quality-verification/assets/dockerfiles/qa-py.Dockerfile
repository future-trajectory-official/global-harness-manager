# qa-py: Python checker provision image for quality-verification (WP#855)
#
# Base: python:3.12-slim (digest-pinned for reproducibility).
# uv binary is copied in to honor the "uv-first" PO policy; ruff/pytest are
# installed with exact pins at build time so that runtime works with
# `docker run --network none` (no package fetching at verification time).
#
# Empirical note (2026-10-21): the bare ghcr.io/astral-sh/uv image cannot run
# `uv run`/`uv tool run` under --network none (no managed Python, no libc
# probe tools, package fetch requires network). Hence this baked image.
#
# Rebuild (idempotent; cached layers make it instant when unchanged):
#   docker build -f <skill-dir>/assets/dockerfiles/qa-py.Dockerfile \
#     -t harness-qa-py:<date> <skill-dir>/assets/dockerfiles
# <context> is the Dockerfile's own directory (no COPY . is used; only
# COPY --from pinned images + pip installs from the network at build time).
# Runtime: docker run --rm --network none --user UID:GID -v <CWD>:/app:ro -w /app <image> <checker...>
FROM python:3.12-slim@sha256:6c4dd321d176d61ea848dc8c73a4f7dbae8f70e0ee48bb411ea2f045b599fa8e

COPY --from=ghcr.io/astral-sh/uv:0.13.4@sha256:9f130421e930bfbdc563c00740466603f8723158e90297d07957c2294640262b /uv /uvx /bin/

RUN pip install --no-cache-dir "ruff==0.17.1" "pytest==9.1.1" \
  && ruff --version \
  && pytest --version \
  && uv --version \
  && python3 --version

#!/bin/sh
# lib-targets.sh — single source of the Y2 exclusion list (WP#855).
#
# The exclusion LIST is defined here only. `detect-languages.sh` and the
# `run-qa-*.sh` runners source this file so detection and execution scopes
# never drift apart. SKILL.md documents the list by reference.
#
# Usage: . "<skill-dir>/scripts/lib-targets.sh"
#        list_targets <caller-dir> '<glob>'   # prints relative paths, sorted
#
# NOTE: paths with newlines are unsupported; spaces are preserved only when
# the caller reads line-wise (no word splitting). Repos with such names are
# out of scope (consistent with `deno task` constraints).

# Directories pruned at any depth (single source; keep in sync nowhere else):
# .git node_modules cov_profile dist build __pycache__ vendor

list_targets() {
  dir="$1"
  pattern="$2"
  ( cd "$dir" 2>/dev/null && find . -type d \
    \( -name .git -o -name node_modules -o -name cov_profile \
    -o -name dist -o -name build -o -name __pycache__ -o -name vendor \) \
    -prune -o -type f -name "$pattern" -print | sort )
}

# y2_docker_run <caller-abs-dir> <image> <command...>
# Common :ro container invocation (single source; runners must not inline
# their own `docker run` preamble).
y2_docker_run() {
  caller="$1"
  image="$2"
  shift 2
  docker run --rm --network none --user "$(id -u):$(id -g)" \
    -v "$caller:/app:ro" -w /app "$image" "$@"
}

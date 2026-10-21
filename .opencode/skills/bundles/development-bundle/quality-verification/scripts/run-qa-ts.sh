#!/bin/sh
# run-qa-ts.sh — qa:ts branch runner (WP#855).
#
# Usage: sh run-qa-ts.sh <caller-dir>
# Exit: 0 = all checks pass (or deno unavailable: skip with warning);
#       1 = check failure in caller; 2 = usage error.
#
# Gate G (spec: SKILL.md Step 0): when `deno` is not resolvable, only the
# qa:ts branch stops (recorded as environment shortage + install guidance);
# py/sh branches continue. This script never fails closed on a missing
# runner — it reports and exits 0 so the AND-aggregation upstream can tell
# "skipped" apart from "failed".
#
# D1 present (caller owns deno.json/deno.jsonc): the caller's own
# `deno task qa` runs (Y1 non-scope: nothing is placed in the caller).
# D2 only (ts files without config): the steps run directly against
# explicitly enumerated ts files — no fallback config is placed anywhere,
# and `deno check` with an empty list is skipped with a warning instead of
# relying on shell glob expansion.
set -u

if [ "$#" -ne 1 ]; then
  echo "usage: run-qa-ts.sh <caller-dir>" >&2
  exit 2
fi
CALLER=$(cd "$1" 2>/dev/null && pwd) || exit 2
if [ ! -d "$CALLER" ]; then
  echo "run-qa-ts: not a directory: $1" >&2
  exit 2
fi

SKILL_DIR=$(cd "$(dirname "$0")/.." && pwd)
. "$SKILL_DIR/scripts/lib-targets.sh"

if ! command -v deno >/dev/null 2>&1; then
  echo "qa:ts: SKIP (gate G: deno not installed; environment shortage, install guidance recorded)"
  exit 0
fi

cd "$CALLER" || exit 2

if [ -f deno.json ] || [ -f deno.jsonc ]; then
  echo "qa:ts: caller owns deno config; running caller's own qa"
  deno task qa
  RC=$?
  echo "qa:ts: exit=$RC"
  exit "$RC"
fi

TS_FILES=$(list_targets "$CALLER" '*.ts') || exit 2
if [ -z "$TS_FILES" ]; then
  echo "qa:ts: no ts files and no deno config (nothing to do)"
  exit 0
fi

# shellcheck disable=SC2086
set -- $TS_FILES

echo "qa:ts: D2-only caller; running steps directly (no config placed)"
deno fmt --check "$@" && deno lint "$@" && deno check "$@" && deno test
RC=$?
echo "qa:ts: exit=$RC"
exit "$RC"

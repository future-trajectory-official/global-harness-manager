#!/bin/sh
# detect-languages.sh — Y2 caller language detection (WP#855).
#
# Usage: sh detect-languages.sh <caller-dir>
# Output (single line): CASE=<A|B|C|D|E> TS=<n> PY=<n> SH=<n> D1=<yes|no>
# Exit: 0 on success (including CASE=E); 2 when <caller-dir> is unusable.
#
# Conditions (spec: SKILL.md Step 0):
#   D1: <dir>/deno.json or deno.jsonc exists (test -f)
#   D2: >=1 *.ts after exclusions
#   P1: >=1 *.py after exclusions
#   S1: >=1 *.sh after exclusions
# Exclusions: .git node_modules cov_profile dist build __pycache__ vendor
#   (.opencode/node_modules is covered by the node_modules rule at any depth)
#   The exclusion LIST lives in lib-targets.sh (single source); this script
#   only maps counts to a CASE.
#
# NOTE: prune uses `-type d \( -name <dir> ... \) -prune` (any depth) instead
# of the design draft's top-level `-path` form, so nested cache/vendor dirs in
# real callers are also excluded. The exclusion LIST itself is unchanged.
set -eu

SKILL_DIR=$(cd "$(dirname "$0")/.." && pwd)
. "$SKILL_DIR/scripts/lib-targets.sh"

target="${1:-.}"
case "$target" in
  /*) CALLER_ABS="$target" ;;
  *) CALLER_ABS="$(cd "$target" 2>/dev/null && pwd)" || exit 2 ;;
esac
if [ ! -d "$CALLER_ABS" ]; then
  exit 2
fi

count() {
  list_targets "$CALLER_ABS" "$1" | wc -l | tr -d '[:space:]'
}

if [ -f "$CALLER_ABS/deno.json" ] || [ -f "$CALLER_ABS/deno.jsonc" ]; then
  d1="yes"
else
  d1="no"
fi

ts_count=$(count '*.ts')
py_count=$(count '*.py')
sh_count=$(count '*.sh')

if [ "$d1" = "yes" ] || [ "$ts_count" -gt 0 ]; then
  case_id="A"
elif [ "$py_count" -gt 0 ] && [ "$sh_count" -gt 0 ]; then
  case_id="B"
elif [ "$py_count" -gt 0 ]; then
  case_id="C"
elif [ "$sh_count" -gt 0 ]; then
  case_id="D"
else
  case_id="E"
fi

printf 'CASE=%s TS=%s PY=%s SH=%s D1=%s\n' "$case_id" "$ts_count" "$py_count" "$sh_count" "$d1"

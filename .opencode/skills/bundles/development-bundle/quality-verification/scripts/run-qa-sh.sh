#!/bin/sh
# run-qa-sh.sh — qa:sh branch runner (WP#855).
#
# Usage: sh run-qa-sh.sh <caller-dir>
# Exit: 0 = shellcheck clean AND shfmt clean;
#       1 = findings (shellcheck warnings or shfmt diff — the latter means
#           the caller needs formatting, NOT a checker malfunction);
#       2 = usage error or checker infrastructure error.
#
# Target files are enumerated with the same exclusions as detection
# (lib-targets.sh), so execution scope always matches the CASE verdict.
# Both images are entrypoint-style: do NOT repeat the binary name.
set -u

SKILL_DIR=$(cd "$(dirname "$0")/.." && pwd)
. "$SKILL_DIR/scripts/lib-targets.sh"

if [ "$#" -ne 1 ]; then
  echo "usage: run-qa-sh.sh <caller-dir>" >&2
  exit 2
fi
CALLER=$(cd "$1" 2>/dev/null && pwd) || exit 2
if [ ! -d "$CALLER" ]; then
  echo "run-qa-sh: not a directory: $1" >&2
  exit 2
fi

SC_IMAGE="koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d"
SF_IMAGE="mvdan/shfmt:v3.14.1@sha256:8c06884a35683d8763fba6c0d9484d11a61a96da65f8d497d6f625825a6043f2"

SH_FILES=$(list_targets "$CALLER" '*.sh') || exit 2
if [ -z "$SH_FILES" ]; then
  echo "qa:sh: no sh files (skip)"
  exit 0
fi

# shellcheck disable=SC2086
set -- $SH_FILES

echo "qa:sh: shellcheck $*"
y2_docker_run "$CALLER" "$SC_IMAGE" "$@"
SC_RC=$?
echo "qa:sh: shellcheck exit=$SC_RC"

echo "qa:sh: shfmt -d $*"
y2_docker_run "$CALLER" "$SF_IMAGE" -d "$@"
SF_RC=$?
case "$SF_RC" in
  0) echo "qa:sh: shfmt exit=0 (clean)" ;;
  1) echo "qa:sh: shfmt exit=1 (format diff in caller; recorded, branch FAIL)" ;;
  *) echo "qa:sh: shfmt exit=$SF_RC (ERROR)" ;;
esac

if [ "$SC_RC" -ne 0 ]; then
  echo "qa:sh: => FAIL (shellcheck)"
  exit 1
fi
if [ "$SF_RC" -ne 0 ]; then
  echo "qa:sh: => FAIL (shfmt)"
  exit 1
fi
echo "qa:sh: => PASS"
exit 0

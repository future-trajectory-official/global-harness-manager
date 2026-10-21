#!/bin/sh
# run-qa-py.sh — qa:py branch runner (WP#855).
#
# Usage: sh run-qa-py.sh <caller-dir>
# Exit: 0 = ruff pass AND (pytest pass OR no tests collected);
#       1 = checker finding (ruff findings, pytest failures);
#       2 = usage error or checker infrastructure error.
#
# Aggregation rule (spec: SKILL.md Step 2):
#   pytest exit 5 (no tests collected) is recorded as "no tests", NOT a
#   failure. Any other non-zero pytest/ruff exit fails the branch.
#
# The image is always built before running (PO#855-5 decision). The build is
# idempotent: cached layers make it instant when nothing changed, and the
# Dockerfile (assets/dockerfiles/qa-py.Dockerfile) is the single source of
# checker versions. The caller is mounted read-only; ruff uses --no-cache and
# pytest runs with bytecode/cache writes disabled, so :ro is safe.
set -u

SKILL_DIR=$(cd "$(dirname "$0")/.." && pwd)
. "$SKILL_DIR/scripts/lib-targets.sh"

if [ "$#" -ne 1 ]; then
  echo "usage: run-qa-py.sh <caller-dir>" >&2
  exit 2
fi
CALLER=$(cd "$1" 2>/dev/null && pwd) || exit 2
if [ ! -d "$CALLER" ]; then
  echo "run-qa-py: not a directory: $1" >&2
  exit 2
fi

IMAGE="harness-qa-py:20261021"
DOCKERFILE="$SKILL_DIR/assets/dockerfiles/qa-py.Dockerfile"

echo "qa:py: building checker image (cached when unchanged)..."
docker build -f "$DOCKERFILE" -t "$IMAGE" "$(dirname "$DOCKERFILE")" || exit 2
IMAGE_DIGEST=$(docker inspect "$IMAGE" --format='{{.Id}}' 2>/dev/null || echo "unknown")
echo "qa:py: image=$IMAGE digest=$IMAGE_DIGEST"

PY_FILES=$(list_targets "$CALLER" '*.py') || exit 2
if [ -z "$PY_FILES" ]; then
  echo "qa:py: no py files (skip)"
  exit 0
fi

# shellcheck disable=SC2086
set -- $PY_FILES

echo "qa:py: ruff check --no-cache $*"
y2_docker_run "$CALLER" "$IMAGE" ruff check --no-cache "$@"
RUFF_RC=$?
echo "qa:py: ruff exit=$RUFF_RC"

# pytest runs on test files only (test_*.py / *_test.py convention).
# Passing every .py module would import caller code with undeclared
# third-party deps and fail collection — that is not a test failure.
TEST_FILES=$( { list_targets "$CALLER" 'test_*.py'; list_targets "$CALLER" '*_test.py'; } | sort -u ) || exit 2
if [ -z "$TEST_FILES" ]; then
  echo "qa:py: no test files (test_*.py / *_test.py); pytest skipped, recorded as no tests"
  PYTEST_RC=5
else
  # shellcheck disable=SC2086
  set -- $TEST_FILES
  echo "qa:py: pytest $*"
  y2_docker_run "$CALLER" "$IMAGE" \
    env PYTHONDONTWRITEBYTECODE=1 pytest -p no:cacheprovider "$@"
  PYTEST_RC=$?
fi
case "$PYTEST_RC" in
  0) echo "qa:py: pytest exit=0 (pass)" ;;
  5) echo "qa:py: pytest exit=5 (no tests collected; recorded, not a failure)" ;;
  *) echo "qa:py: pytest exit=$PYTEST_RC (FAIL)" ;;
esac

if [ "$RUFF_RC" -ne 0 ]; then
  echo "qa:py: => FAIL (ruff)"
  exit 1
fi
if [ "$PYTEST_RC" -ne 0 ] && [ "$PYTEST_RC" -ne 5 ]; then
  echo "qa:py: => FAIL (pytest)"
  exit 1
fi
echo "qa:py: => PASS"
exit 0

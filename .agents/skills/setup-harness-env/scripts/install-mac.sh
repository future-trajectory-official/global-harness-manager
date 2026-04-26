#!/bin/bash
set -e
HARNESS_ROOT=$(cd "$(dirname "$0")/../../../../" && pwd)
BIN_DIR="$HARNESS_ROOT/bin"
ARCH_NAME=$(uname -m)

if [ "$ARCH_NAME" = "x86_64" ]; then DENO_TARGET="x86_64-apple-darwin"
elif [ "$ARCH_NAME" = "arm64" ] || [ "$ARCH_NAME" = "aarch64" ]; then DENO_TARGET="aarch64-apple-darwin"
else echo "Unsupported architecture $ARCH_NAME"; exit 1; fi

mkdir -p "$BIN_DIR"
if [ ! -f "$BIN_DIR/deno" ]; then
    echo "Downloading Deno ($DENO_TARGET)..."
    curl -sL "https://github.com/denoland/deno/releases/download/v2.0.2/deno-${DENO_TARGET}.zip" -o "$BIN_DIR/deno.zip"
    unzip -q "$BIN_DIR/deno.zip" -d "$BIN_DIR" && rm "$BIN_DIR/deno.zip"
    chmod +x "$BIN_DIR/deno"
fi

echo "Starting Deno setup..."
"$BIN_DIR/deno" run -A "$HARNESS_ROOT/.agents/skills/setup-harness-env/scripts/setup.ts"

#!/bin/bash
# stateless-reset: 記憶とナレッジを一時ディレクトリへ退避させるスクリプト

set -e

# ターゲットフォルダの指定 (デフォルト: $HOME/.gemini/antigravity)
TARGET_ROOT="${1:-$HOME/.gemini/antigravity}"
# 退避先（システム一時ディレクトリ）の作成
TIMESTAMP=$(date +%s)
BACKUP_DIR="/tmp/antigravity_context_$TIMESTAMP"

echo "--- 記憶のリセットを開始します (Stateless Reset) ---"
echo "ターゲット: $TARGET_ROOT"

mkdir -p "$BACKUP_DIR"

COUNT=0
for dir in brain knowledge conversations; do
  if [ -d "$TARGET_ROOT/$dir" ]; then
    echo "退避中: $dir -> $BACKUP_DIR/"
    mv "$TARGET_ROOT/$dir" "$BACKUP_DIR/"
    # 空のディレクトリを再作成して構造を維持
    mkdir -p "$TARGET_ROOT/$dir"
    COUNT=$((COUNT + 1))
  fi
done

echo "--------------------------------------------------------"
echo "完了: $COUNT 件のディレクトリを退避しました。"
echo "退避先パス: $BACKUP_DIR"
echo "※ OS による自動クリーンアップまでデータは保持されます。"
echo "--------------------------------------------------------"

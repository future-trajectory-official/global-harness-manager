#!/bin/bash
# オンボーディングに必要な設定ファイルが揃っているかを事前にチェックするスクリプト

FILES=(
  ".agents/skills/manage-git-identity/config/identities.txt"
  ".agents/skills/setup-harness-env/config/global-skills-path.txt"
  ".agents/skills/publish-harness-rules/config/publish-rules-targets.md"
  ".agents/skills/publish-harness-skills/config/publish-targets.txt"
)
MISSING=0

echo "🔍 設定ファイルの事前チェックを開始します..."

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ [ERROR] ファイルがありません: $file"
    echo "   (※ $file.example 等をコピーして作成してください)"
    MISSING=1
  else
    # 空ファイルかどうかの簡易チェック
    if [ ! -s "$file" ]; then
      echo "⚠️ [WARN] ファイルが空です: $file"
      MISSING=1
    else
      echo "✅ [OK] $file の存在を確認しました。"
    fi
  fi
done

if [ $MISSING -eq 1 ]; then
  echo ""
  echo "🚨 [FAILED] 必要な設定ファイルが不足しているか、情報が記入されていません。"
  echo "各ファイルをプロジェクト要件に合わせて作成・記入した上で、再度実行してください。"
  exit 1
fi

echo ""
echo "🎉 全ての設定ファイルの準備が完了しています！"
exit 0

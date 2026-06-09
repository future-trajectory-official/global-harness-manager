#!/bin/bash
# publish-harness-skills: ワークスペースのスキルをグローバルディレクトリへ同期します
# 1. config/global-skills-path.txt から最初の有効なパスを取得
# 2. config/publish-targets.txt から対象スキル名を取得
# 3. 各スキルの .gitignore を考慮して rsync --delete 実行

set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
HARNESS_ROOT=$(cd "$SCRIPT_DIR/../../../../" && pwd)
CONFIG_GLOBAL_PATH="$HARNESS_ROOT/config/global-skills-path.txt"
CONFIG_TARGETS="$HARNESS_ROOT/config/publish-targets.md"
EXAMPLE_CONFIG="$HARNESS_ROOT/config/publish-targets.md.example"
LOCAL_SKILLS_DIR="$HARNESS_ROOT/.agents/skills"

echo "--- ハーネススキルのグローバル同期を開始します (Publishing Skills) ---"

# --- 1. グローバルパスの特定 ---
if [ ! -f "$CONFIG_GLOBAL_PATH" ]; then
    echo "エラー: $CONFIG_GLOBAL_PATH が見つかりません。"
    exit 1
fi

GLOBAL_DEST=""
while read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue
    # 相対パスを絶対パスに変換
    GLOBAL_DEST=$(cd "$HARNESS_ROOT" && realpath -m "$line")
    break
done < "$CONFIG_GLOBAL_PATH"

if [ -z "$GLOBAL_DEST" ]; then
    echo "エラー: 有効なグローバル書き出し先パスが $CONFIG_GLOBAL_PATH に見つかりません。"
    exit 1
fi

echo "同期先: $GLOBAL_DEST"

# 送信先ディレクトリの準備
mkdir -p "$GLOBAL_DEST"

# --- 2. 公開対象スキルの処理 ---
if [ ! -f "$CONFIG_TARGETS" ]; then
    echo "--- エラー: 同期を中断します ---"
    echo "警告: $CONFIG_TARGETS が見つかりませんでした。"
    echo "まずはじめに以下の手順で設定ファイルを作成してください。"
    echo ""
    echo "【対応方法】:"
    echo "1. $EXAMPLE_CONFIG をコピーして $CONFIG_TARGETS を作成してください。"
    echo "2. $CONFIG_TARGETS を開き、移行対象にしたいスキルのフォルダ名を '##' で記述してください。"
    echo "3. 再度このスクリプトを実行してください。"
    echo ""
    exit 1
fi

# Markdown の ## セクションからスキル名のみを抽出 (## skill-name)
# sed で先頭の ## を消し、各行の前後空白を削除
SKILL_NAMES=$(grep '^## ' "$CONFIG_TARGETS" | sed 's/^## //' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

SUCCESS_COUNT=0
SKIP_COUNT=0

while read -r SKILL_NAME; do
    [ -z "$SKILL_NAME" ] && continue
    LOCAL_SKILL_PATH="$LOCAL_SKILLS_DIR/$SKILL_NAME"
    DEST_SKILL_PATH="$GLOBAL_DEST/$SKILL_NAME"
    
    if [ ! -d "$LOCAL_SKILL_PATH" ]; then
        echo "警告: スキル '$SKILL_NAME' が $LOCAL_SKILLS_DIR に存在しません。スキップします。"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        continue
    fi
    
    echo "同期中: $SKILL_NAME ..."
    
    # 基本的な除外設定
    RSYNC_OPTS="-av --delete"
    RSYNC_OPTS="$RSYNC_OPTS --exclude=.git/"
    RSYNC_OPTS="$RSYNC_OPTS --exclude=.DS_Store"
    RSYNC_OPTS="$RSYNC_OPTS --exclude=.ipynb_checkpoints/"
    RSYNC_OPTS="$RSYNC_OPTS --exclude=__pycache__/"
    
    # スキル固有の除外設定 (.gitignore があれば読み込む)
    if [ -f "$LOCAL_SKILL_PATH/.gitignore" ]; then
        RSYNC_OPTS="$RSYNC_OPTS --exclude-from=$LOCAL_SKILL_PATH/.gitignore"
    fi

    # 同期実行
    # 注: trailing slash を付けることでディレクトリの中身をコピーする
    rsync $RSYNC_OPTS "$LOCAL_SKILL_PATH/" "$DEST_SKILL_PATH/" >> /dev/null
    
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
done <<EOF
$SKILL_NAMES
EOF

echo "--------------------------------------------------------"
echo "完了: $SUCCESS_COUNT 件のスキルを同期しました。($SKIP_COUNT 件スキップ)"
echo "同期先ディレクトリを確認してください: $GLOBAL_DEST"
echo "--------------------------------------------------------"

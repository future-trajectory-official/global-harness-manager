#!/bin/bash
# global-harness-manager 初期構築スクリプト
# 1. 設定ファイルの存在確認
# 2. gh スタンドアロンバイナリの導入と PATH 設定
# 3. 指定されたグローバルスキルのパス (skills.txt) に登録

set -e

HARNESS_ROOT=$(cd "$(dirname "$0")/.." && pwd)
BIN_DIR="$HARNESS_ROOT/bin"
CONFIG_FILE="$HOME/.gemini/antigravity/skills.txt"
HARNESS_CONFIG="$HARNESS_ROOT/config/global-skills-path.txt"
EXAMPLE_CONFIG="$HARNESS_ROOT/config/global-skills-path.txt.example"

# --- 1. 設定ファイルの確認 ---
if [ ! -f "$HARNESS_CONFIG" ]; then
    echo "--- エラー: 初期化を中断します ---"
    echo "警告: $HARNESS_CONFIG が見つかりませんでした。"
    echo "まずはじめに以下の手順で設定ファイルを作成してください。"
    echo ""
    echo "【対応方法】:"
    echo "1. $EXAMPLE_CONFIG をコピーして $HARNESS_CONFIG を作成してください。"
    echo "2. $HARNESS_CONFIG を開き、登録したいディレクトリを一行ずつ記述してください。"
    echo "3. 再度このスクリプトを実行してください。"
    echo ""
    echo "※ 設定ファイルがない状態で初期化を進めることはできません。"
    exit 1
fi

echo "--- ハーネス初期化を開始します (Harness Initialization) ---"

# --- 2. gh バイナリの導入 (Linux x86_64 想定) ---
mkdir -p "$BIN_DIR"
if [ ! -f "$BIN_DIR/gh" ]; then
    echo "GitHub CLI (gh) スタンドアロンバイナリをダウンロード中..."
    GH_RELEASE_URL="https://github.com/cli/cli/releases/download/v2.47.0/gh_2.47.0_linux_amd64.tar.gz"
    curl -sL "$GH_RELEASE_URL" -o "$BIN_DIR/gh.tar.gz"
    tar xzf "$BIN_DIR/gh.tar.gz" -C "$BIN_DIR" --strip-components=1
    mv "$BIN_DIR/bin/gh" "$BIN_DIR/gh"
    rm -rf "$BIN_DIR/bin" "$BIN_DIR/share" "$BIN_DIR/gh.tar.gz"
    chmod +x "$BIN_DIR/gh"
    echo "Success: gh バイナリを $BIN_DIR/gh に配置しました。"
else
    echo "Info: gh バイナリは既に存在します。"
fi

# --- 3. PATH の設定 (bashrc への追記) ---
if ! grep -q "$BIN_DIR" "$HOME/.bashrc"; then
    echo "ターミナルから gh を直接使えるように ~/.bashrc に PATH を追記します..."
    echo "" >> "$HOME/.bashrc"
    echo "# global-harness-manager: gh binary path" >> "$HOME/.bashrc"
    echo "export PATH=\"\$PATH:$BIN_DIR\"" >> "$HOME/.bashrc"
    echo "Success: ~/.bashrc に PATH を追加しました。"
    echo "【注意】今開いているこのターミナルだけで反映させる場合は、'source ~/.bashrc' を実行してください。"
    echo "次回以降新しくターミナルを開く際は、自動的に反映されるようになっています。"
else
    echo "Info: ~/.bashrc には既に PATH が設定されています。"
fi

# --- 4. skills.txt への登録 (活性化) ---
echo "Antigravity のグローバルパス (skills.txt) を構成しています..."
mkdir -p "$(dirname "$CONFIG_FILE")"
touch "$CONFIG_FILE"

echo "設定ファイルをロードしています: $HARNESS_CONFIG"
# テキストファイルを一行ずつ読み込む (コメント行と空行を除外)
while read -r TARGET_PATH || [[ -n "$TARGET_PATH" ]]; do
    # コメント行 (#) と 空行をスキップ
    [[ "$TARGET_PATH" =~ ^#.*$ ]] && continue
    [[ -z "$TARGET_PATH" ]] && continue
    
    # 相対パスを絶対パスに変換
    ABS_PATH=$(cd "$HARNESS_ROOT" && realpath -m "$TARGET_PATH")

    # ディレクトリが存在しない場合は作成を試みる
    if [ ! -d "$ABS_PATH" ]; then
        echo "ディレクトリを作成中: $ABS_PATH"
        mkdir -p "$ABS_PATH" || { echo "警告: ディレクトリの作成に失敗しました: $ABS_PATH"; continue; }
    fi

    # skills.txt への登録 (重複チェック)
    if ! grep -Fxq "$ABS_PATH" "$CONFIG_FILE"; then
        echo "スキルパスを登録中: $ABS_PATH"
        echo "$ABS_PATH" >> "$CONFIG_FILE"
    else
        echo "Info: $ABS_PATH は既に登録済みです。"
    fi
done < "$HARNESS_CONFIG"

echo "--- 初期化が完了しました (Initialization Complete) ---"
echo "GitHub への SSH 鍵登録（scripts/add-identity.sh）へ進んでください。"
echo "--------------------------------------------------------"

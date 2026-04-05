#!/bin/bash
# global-harness-manager アイデンティティ追加スクリプト
# 1. 設定ファイルの存在確認
# 2. 設定ファイルに基づく SSH 鍵の一括生成 (Ed25519)
# 3. ~/.ssh/config へのエイリアス一括登録

set -e

HARNESS_ROOT=$(cd "$(dirname "$0")/.." && pwd)
IDENTITY_CONFIG="$HARNESS_ROOT/config/identities.txt"
EXAMPLE_CONFIG="$HARNESS_ROOT/config/identities.txt.example"
SSH_CONFIG="$HOME/.ssh/config"

# --- 1. 設定ファイルの確認 ---
if [ ! -f "$IDENTITY_CONFIG" ]; then
    echo "--- エラー: アイデンティティの登録を中断します ---"
    echo "警告: $IDENTITY_CONFIG が見つかりませんでした。"
    echo ""
    echo "【対応方法】:"
    echo "1. $EXAMPLE_CONFIG をコピーして $IDENTITY_CONFIG を作成してください。"
    echo "2. $IDENTITY_CONFIG に登録したいアカウント情報を記述してください。"
    echo "3. 再度このスクリプトを実行してください。"
    exit 1
fi

echo "--- アイデンティティ登録処理を開始します (Identity Setup) ---"

# 登録が必要な鍵の情報を蓄積する一時ファイル
REPORT_TMP=$(mktemp)

# --- 2. 設定ファイルの読み込みと一括処理 ---
while read -r line || [[ -n "$line" ]]; do
    # コメント行 (#) と 空行をスキップ
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue
    
    # カンマ区切りでアカウント名とメールアドレスを取得
    ACCOUNT_NAME=$(echo "$line" | cut -d',' -f1 | xargs)
    ACCOUNT_EMAIL=$(echo "$line" | cut -d',' -f2 | xargs)
    
    if [ -z "$ACCOUNT_NAME" ] || [ -z "$ACCOUNT_EMAIL" ]; then
        echo "警告: 行のフォーマットが正しくありません: $line (スキップします)"
        continue
    fi

    SSH_KEY_PATH="$HOME/.ssh/id_ed25519_$ACCOUNT_NAME"
    HOST_ALIAS="github.com-$ACCOUNT_NAME"

    # SSH 鍵の生成
    if [ -f "$SSH_KEY_PATH" ]; then
        echo "Info: $ACCOUNT_NAME 用の鍵は既に存在します。スキップします。"
    else
        echo "$ACCOUNT_NAME 用の SSH 鍵を生成中..."
        mkdir -p "$HOME/.ssh"
        ssh-keygen -t ed25519 -C "$ACCOUNT_EMAIL" -f "$SSH_KEY_PATH" -N ""
        
        # 報告用リストに追加
        {
            echo "--------------------------------------------------------"
            echo "■ アカウント: $ACCOUNT_NAME"
            echo "【重要】GitHubでこのアカウントにログインしていることを確認してください！"
            echo "登録先URL: https://github.com/settings/ssh/new"
            echo ""
            cat "${SSH_KEY_PATH}.pub"
            echo "--------------------------------------------------------"
        } >> "$REPORT_TMP"
    fi

    # ~/.ssh/config への追加
    touch "$SSH_CONFIG"
    if grep -q "Host $HOST_ALIAS" "$SSH_CONFIG"; then
        echo "Info: $HOST_ALIAS は既に SSH 設定に存在します。"
    else
        echo "SSH エイリアスを構成中: $HOST_ALIAS ..."
        cat >> "$SSH_CONFIG" <<EOF

# Harness managed identity: $ACCOUNT_NAME
Host $HOST_ALIAS
    HostName github.com
    User git
    IdentityFile $SSH_KEY_PATH
EOF
        echo "Success: $HOST_ALIAS を $SSH_CONFIG に追加しました。"
    fi

done < "$IDENTITY_CONFIG"

# --- 3. 最終レポートの表示 ---
if [ -s "$REPORT_TMP" ]; then
    echo ""
    echo "=== 以下の公開鍵を GitHub に登録してください ==="
    echo "※ 複数のアカウントがある場合、一つずつブラウザでログインし直す必要があります。"
    cat "$REPORT_TMP"
    echo ""
    echo "登録後、以下のコマンドでテストを行ってください："
    echo "ssh -T github.com-[アカウント名]"
else
    echo "新規に作成された鍵はありません。すべての構成は最新です。"
fi

rm "$REPORT_TMP"
echo "--------------------------------------------------------"
echo "アイデンティティ登録処理が完了しました。"

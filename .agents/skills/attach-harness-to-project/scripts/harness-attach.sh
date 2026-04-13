#!/bin/bash
# global-harness-manager 資産接続・アカウント固定スクリプト
# 1. リモート URL を SSH エイリアス形式へ書き換え
# 2. プロジェクトローカルの Git アイデンティティ設定 (config/identities.txt から参照)

set -e

USAGE="使用法: $0 <アカウント名> <プロジェクトディレクトリ>"

if [ "$#" -lt 2 ]; then
    echo "$USAGE"
    echo "例: $0 your-account-name path/to/your/project"
    exit 1
fi

ACCOUNT_NAME=$1
PROJECT_DIR=$(readlink -f "$2")
HOST_ALIAS="github.com-$ACCOUNT_NAME"
HARNESS_ROOT=$(cd "$(dirname "$0")/../../../../" && pwd)
IDENTITY_CONFIG="$HARNESS_ROOT/config/identities.txt"

echo "--- ハーネスをプロジェクトに装着中 (Harness Attachment) ---"
echo "Project: $PROJECT_DIR"
echo "Account: $ACCOUNT_NAME (エイリアス $HOST_ALIAS を使用)"

# --- 1. アカウント情報の検索 ---
if [ ! -f "$IDENTITY_CONFIG" ]; then
    echo "エラー: $IDENTITY_CONFIG が見つかりません。"
    echo "まず scripts/add-identity.sh でアイデンティティを作成してください。"
    exit 1
fi

ACCOUNT_EMAIL=$(grep "^$ACCOUNT_NAME," "$IDENTITY_CONFIG" | cut -d',' -f2 || echo "")

if [ -z "$ACCOUNT_EMAIL" ]; then
    echo "エラー: $ACCOUNT_NAME に対するメールアドレスの設定が $IDENTITY_CONFIG に見当たりません。"
    echo "設定ファイルを確認してください。"
    exit 1
fi

if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo "エラー: $PROJECT_DIR は有効な Git リポジトリではありません。"
    exit 1
fi

cd "$PROJECT_DIR"

# --- 2. リモート URL の書き換え (SSH エイリアス化) ---
CURRENT_REMOTE=$(git remote get-url origin)
echo "現在のリモート: $CURRENT_REMOTE"

# HTTPS または 標準SSH を、ハーネスで管理しているエイリアス形式へ強制変換
NEW_REMOTE=$(echo "$CURRENT_REMOTE" | sed -E "s|(https://github.com/\|git@github.com:)|git@$HOST_ALIAS:|")

if [ "$CURRENT_REMOTE" == "$NEW_REMOTE" ]; then
    echo "Info: リモート URL は既にエイリアス形式、またはカスタム設定になっています。"
else
    echo "リモート URL を更新中: $NEW_REMOTE"
    git remote set-url origin "$NEW_REMOTE"
fi

# --- 3. Git アイデンティティ設定 (プロジェクト内限定) ---
echo "Git アイデンティティを設定中: $ACCOUNT_NAME <$ACCOUNT_EMAIL> ..."
git config user.name "$ACCOUNT_NAME"
git config user.email "$ACCOUNT_EMAIL"

echo "Success: $ACCOUNT_NAME <$ACCOUNT_EMAIL> としてアイデンティティを固定しました。"
echo "Success: 以後、このプロジェクトでの通信はアカウント $ACCOUNT_NAME を経由します。"
echo "--------------------------------------------------------"

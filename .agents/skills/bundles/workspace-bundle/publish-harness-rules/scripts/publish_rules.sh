#!/bin/bash

# エラー発生時にスクリプトを停止する
set -e

# グローバル環境のディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
GLOBAL_AGENTS_DIR="$(dirname "$(dirname "$SKILL_DIR")")"
GLOBAL_WORKSPACE_DIR="$(dirname "$GLOBAL_AGENTS_DIR")"

CONFIG_FILE="$GLOBAL_WORKSPACE_DIR/config/publish-rules-targets.md"
SOURCE_RULES_DIR="$GLOBAL_AGENTS_DIR/rules"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "エラー: 設定ファイルが見つかりません: $CONFIG_FILE"
    echo "先に config/publish-rules-targets.md.example をコピーして config/publish-rules-targets.md を作成し、設定を行ってください。"
    exit 1
fi

echo "配布設定 ($CONFIG_FILE) を読み込んでいます..."

# パース用の配列
TARGET_PROJECTS=()
TARGET_RULES=()

# 現在のパース対象セクション (PROJECTS または RULES)
CURRENT_SECTION=""

# 設定ファイルを読み取り、プロジェクトと対象ルールを抽出
while IFS= read -r line; do
    # 空行とコメントはスキップ
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*[^#] ]] || [[ "$line" =~ ^#[^#] ]]; then
        continue
    fi

    # セクションの切り替え
    if [[ "$line" =~ ^##[[:space:]]+Target[[:space:]]+Projects ]]; then
        CURRENT_SECTION="PROJECTS"
        continue
    elif [[ "$line" =~ ^##[[:space:]]+Target[[:space:]]+Rules ]]; then
        CURRENT_SECTION="RULES"
        continue
    fi

    # ### で始まるアイテムを抽出
    if [[ "$line" =~ ^###[[:space:]]+(.+)$ ]]; then
        item="${BASH_REMATCH[1]}"
        # 行末の空白を削除
        item="${item%"${item##*[![:space:]]}"}"
        
        if [ "$CURRENT_SECTION" = "PROJECTS" ]; then
            TARGET_PROJECTS+=("$item")
        elif [ "$CURRENT_SECTION" = "RULES" ]; then
            TARGET_RULES+=("$item")
        fi
    fi
done < "$CONFIG_FILE"

# パース結果の確認
if [ ${#TARGET_PROJECTS[@]} -eq 0 ]; then
    echo "エラー: Target Projects が指定されていません。"
    exit 1
fi

if [ ${#TARGET_RULES[@]} -eq 0 ]; then
    echo "エラー: Target Rules が指定されていません。"
    exit 1
fi

echo "対象プロジェクト数: ${#TARGET_PROJECTS[@]}"
echo "対象ルール数: ${#TARGET_RULES[@]}"
echo "----------------------------------------"

# コピー処理の開始
for PROJECT in "${TARGET_PROJECTS[@]}"; do
    echo "プロジェクト [$PROJECT] へルールを配布中..."
    
    TARGET_RULES_DIR="$PROJECT/.agents/rules"
    TARGET_GITIGNORE="$TARGET_RULES_DIR/.gitignore"
    
    # 対象プロジェクトのディレクトリ自体の存在チェック（プロジェクトそのものがない場合は警告してスキップ）
    if [ ! -d "$PROJECT" ]; then
        echo "  警告: プロジェクトディレクトリが存在しません。スキップします: $PROJECT"
        echo ""
        continue
    fi
    
    # .agents/rules ディレクトリが無い場合は作成
    if [ ! -d "$TARGET_RULES_DIR" ]; then
        echo "  .agents/rules ディレクトリを作成します。"
        mkdir -p "$TARGET_RULES_DIR"
    fi
    
    # .gitignore の状態を確認（新規作成か、中身があるか）
    IS_NEW_OR_EMPTY=false
    if [ ! -f "$TARGET_GITIGNORE" ] || [ ! -s "$TARGET_GITIGNORE" ]; then
        IS_NEW_OR_EMPTY=true
    fi

    # .gitignore が無い場合は作成
    if [ ! -f "$TARGET_GITIGNORE" ]; then
        touch "$TARGET_GITIGNORE"
    fi

    # 管理用ヘッダー
    SECTION_HEADER="# [Managed by publish-harness-rules]"

    # ヘッダーが存在しない場合、セクションを追加
    if ! grep -qF "$SECTION_HEADER" "$TARGET_GITIGNORE"; then
        # 既存の内容がある場合、末尾の改行を確認して区切りの空行を入れる
        if [ -s "$TARGET_GITIGNORE" ]; then
            # 末尾が改行で終わっていない場合は改行を入れる
            if [ -n "$(tail -c1 "$TARGET_GITIGNORE" 2>/dev/null)" ]; then
                echo "" >> "$TARGET_GITIGNORE"
            fi
            # セクション前の空行
            echo "" >> "$TARGET_GITIGNORE"
        fi
        echo "$SECTION_HEADER" >> "$TARGET_GITIGNORE"
    fi

    # 新規作成されたか中身が空だった場合のみ、自分自身を管理対象外に設定
    if [ "$IS_NEW_OR_EMPTY" = true ]; then
        GITIGNORE_SELF="/.gitignore"
        if ! grep -qxF "$GITIGNORE_SELF" "$TARGET_GITIGNORE"; then
            echo "$GITIGNORE_SELF" >> "$TARGET_GITIGNORE"
            echo "  .gitignore を自身に登録しました（新規/空ファイルのため）。"
        fi
    fi
    
    for RULE in "${TARGET_RULES[@]}"; do
        SOURCE_RULE_FILE="$SOURCE_RULES_DIR/$RULE.md"
        TARGET_RULE_FILE="$TARGET_RULES_DIR/$RULE.md"
        
        if [ ! -f "$SOURCE_RULE_FILE" ]; then
            echo "  警告: コピー元のルールファイルが存在しません: $RULE.md"
            continue
        fi
        
        # ルールファイルをコピー
        cp "$SOURCE_RULE_FILE" "$TARGET_RULE_FILE"
        echo "  コピー完了: $RULE.md"
        
        # .gitignore への追記チェック
        GITIGNORE_ENTRY="/$RULE.md"
        if ! grep -qxF "$GITIGNORE_ENTRY" "$TARGET_GITIGNORE"; then
            # 常に末尾が改行で終わっているか確認（他からの手動編集などで崩れている可能性も考慮）
            if [ -n "$(tail -c1 "$TARGET_GITIGNORE" 2>/dev/null)" ]; then
                echo "" >> "$TARGET_GITIGNORE"
            fi
            echo "$GITIGNORE_ENTRY" >> "$TARGET_GITIGNORE"
            echo "  .gitignore に追記しました: $GITIGNORE_ENTRY"
        fi
    done
    
    echo "プロジェクト [$PROJECT] への配布が完了しました。"
    echo ""
done

echo "すべての処理が完了しました。"

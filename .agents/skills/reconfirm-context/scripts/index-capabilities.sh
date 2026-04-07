#!/bin/bash

# ターミナル出力用の装飾設定 (エージェントが構造を読み取りやすくするため)
BOLD="\033[1m"   # 太字開始
RESET="\033[0m"  # 装飾リセット

echo -e "${BOLD}=== コンテキスト再確認 (ルールとスキルのインデックス) ===${RESET}\n"

# 1. ルール (最優先事項: GEMINI.md)
echo -e "${BOLD}## [ルール / 役割]${RESET}"

# 共通設定ファイル (~/.gemini/GEMINI.md) - エージェントの憲法として最優先で表示
GLOBAL_GEMINI="$HOME/.gemini/GEMINI.md"
if [ -f "$GLOBAL_GEMINI" ]; then
    echo -e "### ${BOLD}GEMINI.md${RESET} (最優先事項 / 憲法)"
    # 冒頭部分をインデントして表示
    head -n 20 "$GLOBAL_GEMINI" | sed 's/^/  /'
    echo ""
fi

# プロジェクト固有のロール (.agents/rules/*.md) - 憲法に基づいた各専門領域
if [ -d .agents/rules ]; then
    for file in .agents/rules/*.md; do
        if [ -f "$file" ]; then
            echo -e "### ${BOLD}$(basename "$file" .md)${RESET}"
            # YAMLフロントマターのみを抽出
            awk 'BEGIN {count=0} /^---[[:space:]]*\r?$/ {count++; print; if (count==2) exit; next} {if (count>0) print}' "$file"
            echo ""
        fi
    done
fi

# 2. 登録済みスキル (グローバルおよびワークスペース固有)
echo -e "${BOLD}## [スキル / 能力]${RESET}"
SKILLS_TXT="$HOME/.gemini/antigravity/skills.txt"

process_skill_root() {
    local base_path="$1"
    local category_name="$2"
    [ ! -d "$base_path" ] && return
    
    local abs_base=$(realpath -m "$base_path")
    for skill_dir in "$abs_base"/*; do
        if [ -f "$skill_dir/SKILL.md" ]; then
            echo -e "### ${BOLD}$(basename "$skill_dir")${RESET} (${category_name})"
            awk 'BEGIN {count=0} /^---[[:space:]]*\r?$/ {count++; print; if (count==2) exit; next} {if (count>0) print}' "$skill_dir/SKILL.md"
            echo ""
        fi
    done
}

# skills.txt からグローバルスキルを取得
if [ -f "$SKILLS_TXT" ]; then
    while read -r path || [[ -n "$path" ]]; do
        [[ "$path" =~ ^#.*$ ]] && continue
        [[ -z "$path" ]] && continue
        process_skill_root "$path" "グローバル"
    done < "$SKILLS_TXT"
fi

# 実行時のプロジェクト固有のスキル
if [ -d .agents/skills ]; then
    process_skill_root ".agents/skills" "プロジェクト固有"
fi

echo -e "\n${BOLD}=== 再確認完了 ===${RESET}"
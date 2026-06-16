---
name: github-wp-search
description: ラベル・状態・マイルストーンでWork Package（子Issue）を検索する。
tags:
  trigger:
    - github-wp-search
    - wp-search
  category: management
  constraints: none
---

# github-wp-search

指定したフィルタ条件に基づいてWork Package（子Issue）を検索します。`github-pbi-search`
と類似のIFですが、WP検索に特化しています。

## 前提条件

- `--repo` に `owner/repo` 形式の有効なリポジトリを指定すること

## Quick-Start

```bash
# Usage: echo '<json>' | deno run -A <script> --repo <owner>/<repo> [--label-prefix <prefix>] [--dry-run]
echo '{"labels":["type:WP"],"state":"open","limit":20}' | deno run -A .agents/skills/bundles/management-bundle/github-wp-search/scripts/github-wp-search.ts --repo "<owner>/<repo>" --label-prefix "<prefix>" --dry-run
```

## 手順

### 1. フィルタ条件の指定

- 標準入力JSONに以下のフィールドを指定（すべて任意）:
  - `labels`: ラベル配列（`--label-prefix` が透過適用される）
  - `state`: `"open"` / `"closed"` / `"all"`
  - `milestone`: マイルストーン番号
  - `limit`: 最大取得件数

### 2. 実行

- `--dry-run` で事前確認可能

## 詳細リファレンス

- 検索ロジックの詳細は
  [spike-report-github-pbi-skills.md](/.local/spike-report-github-pbi-skills.md) を参照

---
name: github-pbi-search
description: ラベル・状態・マイルストーン・アサイン等でPBI（Issue）を検索する。
tags:
  trigger:
    - github-pbi-search
    - pbi-search
  category: management
  constraints: none
---

# github-pbi-search

指定したフィルタ条件に基づいてPBI（Issue）を検索します。複数のラベルや状態、マイルストーンでの絞り込みが可能です。

## 前提条件

- `--repo` に `owner/repo` 形式の有効なリポジトリを指定すること

## Quick-Start

```bash
# Usage: echo '<json>' | deno run -A <script> --repo <owner>/<repo> [--label-prefix <prefix>] [--dry-run]
echo '{"labels":["type:PBI"],"state":"open","limit":10}' | deno run -A .agents/skills/bundles/management-bundle/github-pbi-search/scripts/github-pbi-search.ts --repo "<owner>/<repo>" --label-prefix "<prefix>" --dry-run
```

## 手順

### 1. フィルタ条件の指定

- 標準入力JSONに以下のフィールドを指定（すべて任意）:
  - `labels`: ラベル配列（`--label-prefix` が透過適用される）
  - `state`: `"open"` / `"closed"` / `"all"`
  - `milestone`: マイルストーン番号
  - `assignee`: アサインされたユーザー名
  - `limit`: 最大取得件数

### 2. 実行

- `--label-prefix` でラベル名にプレフィックスを付与可能

### 3. 出力の確認

- 成功時: `{ success: true, data: [{ number, title, state, labels, milestone }, ...] }`

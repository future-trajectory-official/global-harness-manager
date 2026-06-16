---
name: github-wp-create
description: 既存PBIの子Issue（Work Package）を作成し、親PBIに紐付ける。
tags:
  trigger:
    - github-wp-create
    - wp-create
  category: management
  constraints: none
---

# github-wp-create

既存のPBI（親Issue）に紐づく子Issue（Work Package）を作成します。`parentNumber`
で指定された親Issueに自動的に `attach()` されます。

## 前提条件

- `--repo` に `owner/repo` 形式の有効なリポジトリを指定すること
- 親PBIのIssue番号が判明していること

## Quick-Start

```bash
echo '{"title":"WP_1: ログインAPI実装","body":"## AC\n- [ ] AC1: ...","parentNumber":42}' \
  | deno run -A .agents/skills/bundles/management-bundle/github-wp-create/scripts/github-wp-create.ts \
  --repo "owner/repo" --label-prefix "status:" --dry-run
```

## 手順

### 1. 入力データの準備

- 標準入力JSONに以下のフィールドを指定:
  - `title` (必須): WPのタイトル
  - `body` (任意): Markdown形式の説明（AC一覧等）
  - `parentNumber` (必須): 親PBIのIssue番号
  - `labels` (任意): ラベル配列（デフォルト: `["type:WP"]`）
  - `milestone` (任意): マイルストーン番号

### 2. 実行

- 子Issueを作成後、親Issueに自動 `attach()`
- `--dry-run` 時はattachをスキップ

## 詳細リファレンス

- WP設計の詳細は [spike-report-github-pbi-skills.md](/.local/spike-report-github-pbi-skills.md)
  を参照

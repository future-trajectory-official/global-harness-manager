---
name: github-pbi-open
description: GitHub Issueとして新規PBI（type:PBI）を作成する。
tags:
  trigger:
    - github-pbi-open
    - pbi-create
  category: management
  constraints: none
---

# github-pbi-open

新しいPBI（アイデア段階）をGitHub Issueとして作成します。自動的に `type:PBI` ラベルが付与されます。

## 前提条件

- `--repo` に `owner/repo` 形式の有効なリポジトリを指定すること

## Quick-Start

```bash
# Usage: echo '<json>' | deno run -A <script> --repo <owner>/<repo> [--label-prefix <prefix>] [--dry-run]
echo '{"title":"<PBI-title>","body":"<description>"}' | deno run -A .agents/skills/bundles/management-bundle/github-pbi-open/scripts/github-pbi-open.ts --repo "<owner>/<repo>" --label-prefix "<prefix>" --dry-run
```

## 手順

### 1. 入力データの準備

- 標準入力JSONに以下のフィールドを指定:
  - `title` (必須): PBIのタイトル
  - `body` (任意): Markdown形式の説明
  - `milestone` (任意): マイルストーン番号

### 2. 実行

- `--dry-run` フラグで作成内容を事前確認可能
- `--label-prefix` でラベル名にプレフィックスを付与可能

### 3. 出力の確認

- 成功時: `{ success: true, data: { number, title, labels, state } }`
- 作成されたIssueに `type:PBI` が付与されていることを確認

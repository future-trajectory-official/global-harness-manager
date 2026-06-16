---
name: github-sprint-init
description: スプリントマイルストーンを新規作成する。
tags:
  trigger:
    - github-sprint-init
    - sprint-init
    - milestone-create
  category: management
  constraints: none
---

# github-sprint-init

新しいスプリントを表すマイルストーンをGitHub上に作成します。タイトル・説明・期限日を指定可能です。

## 前提条件

- `--repo` に `owner/repo` 形式の有効なリポジトリを指定すること

## Quick-Start

```bash
# Usage: echo '<json>' | deno run -A <script> --repo <owner>/<repo> [--dry-run]
echo '{"title":"<sprint-title>","description":"<description>","dueOn":"<YYYY-MM-DD>"}' | deno run -A .agents/skills/bundles/management-bundle/github-sprint-init/scripts/github-sprint-init.ts --repo "<owner>/<repo>" --dry-run
```

## 手順

### 1. 入力データの準備

- 標準入力JSONに以下のフィールドを指定:
  - `title` (必須): マイルストーン名（例: "Sprint 12"）
  - `description` (任意): Markdown形式の説明
  - `dueOn` (任意): 期限日（YYYY-MM-DD形式）

### 2. 実行

- `--dry-run` で事前確認可能

### 3. 出力の確認

- 成功時: `{ success: true, data: { number, title } }`

## 詳細リファレンス

- スプリント計画フローの詳細は
  [spike-report-github-pbi-skills.md](/.local/spike-report-github-pbi-skills.md) を参照

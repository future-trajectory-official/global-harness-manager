---
name: github-pbi-update
description: 既存PBI（Issue）のタイトル・本文・ラベル・マイルストーン・状態を更新する。
tags:
  trigger:
    - github-pbi-update
    - pbi-update
  category: management
  constraints: none
---

# github-pbi-update

既存のPBI（Issue）を検索し、タイトル・本文・マイルストーン・状態の変更、およびラベルの追加・削除を一括で反映します。

## 前提条件

- `--repo` に `owner/repo` 形式の有効なリポジトリを指定すること
- 更新対象のIssue番号が判明していること

## Quick-Start

```bash
# Usage: echo '<json>' | deno run -A <script> --repo <owner>/<repo> [--label-prefix <prefix>] [--dry-run]
echo '{"number":<issue-number>,"title":"<new-title>"}' | deno run -A .agents/skills/bundles/management-bundle/github-pbi-update/scripts/github-pbi-update.ts --repo "<owner>/<repo>" --label-prefix "<prefix>" --dry-run
```

## 手順

### 1. 更新内容の指定

- 標準入力JSONに以下のフィールドを指定:
  - `number` (必須): 更新対象のIssue番号
  - `title` (任意): 新しいタイトル
  - `body` (任意): 新しい本文
  - `addLabels` (任意): 追加するラベル配列
  - `removeLabels` (任意): 削除するラベル配列
  - `milestone` (任意): 新しいマイルストーン番号
  - `state` (任意): `"open"` / `"closed"`

### 2. 実行

- `--dry-run` で事前確認可能
- `--label-prefix` でラベル名にプレフィックスを付与可能

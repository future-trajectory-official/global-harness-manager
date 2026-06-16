---
name: github-sprint-review-plan
description: 特定のスプリント（マイルストーン）に属するPBI一覧を取得する。
tags:
  trigger:
    - github-sprint-review-plan
    - sprint-review
    - milestone-issues
  category: management
  constraints: none
---

# github-sprint-review-plan

指定したマイルストーンに紐づく全Issueを一覧取得します。スプリントレビュー時の計画確認に使用します。

## 前提条件

- `--repo` に `owner/repo` 形式の有効なリポジトリを指定すること
- 対象マイルストーンが既に作成されていること

## Quick-Start

```bash
echo '{"milestone":"Sprint 12","state":"open"}' \
  | deno run -A .agents/skills/bundles/management-bundle/github-sprint-review-plan/scripts/github-sprint-review-plan.ts \
  --repo "owner/repo" --label-prefix "status:" --dry-run
```

## 手順

### 1. フィルタ条件の指定

- 標準入力JSONに以下のフィールドを指定:
  - `milestone` (必須): マイルストーン番号またはタイトル
  - `labels` (任意): ラベル配列（`--label-prefix` が透過適用される）
  - `state` (任意): `"open"` / `"closed"` / `"all"`
  - `limit` (任意): 最大取得件数

### 2. 実行

- `--dry-run` で事前確認可能

## 詳細リファレンス

- スプリントレビューフローの詳細は
  [spike-report-github-pbi-skills.md](/.local/spike-report-github-pbi-skills.md) を参照

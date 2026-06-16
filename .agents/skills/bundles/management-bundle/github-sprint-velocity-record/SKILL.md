---
name: github-sprint-velocity-record
description: スプリント（マイルストーン）の完了率を集計し、ベロシティ情報を出力する。
tags:
  trigger:
    - github-sprint-velocity-record
    - velocity-record
    - sprint-metrics
  category: management
  constraints: none
---

# github-sprint-velocity-record

指定したマイルストーン配下の全Issueを取得し、完了率（completionRate）を計算して出力します。ラベル操作は行いません。

## 前提条件

- `--repo` に `owner/repo` 形式の有効なリポジトリを指定すること
- 対象マイルストーンが既に作成されていること

## Quick-Start

```bash
echo '{"milestone":"Sprint 12"}' \
  | deno run -A .agents/skills/bundles/management-bundle/github-sprint-velocity-record/scripts/github-sprint-velocity-record.ts \
  --repo "owner/repo" --dry-run
```

## 手順

### 1. 入力データの準備

- 標準入力JSONに以下のフィールドを指定:
  - `milestone` (必須): マイルストーン番号またはタイトル

### 2. 実行

- 状態は `"all"` 固定で全Issueを取得
- 完了率を自動計算

### 3. 出力の確認

- 成功時:
  `{ success: true, data: { milestone, total, open, closed, completionRate, issues: [...] } }`

## 詳細リファレンス

- ベロシティ記録フローの詳細は
  [spike-report-github-pbi-skills.md](/.local/spike-report-github-pbi-skills.md) を参照

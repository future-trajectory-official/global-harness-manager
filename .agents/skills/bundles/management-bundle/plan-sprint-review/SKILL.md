---
name: plan-sprint-review
description: スプリントレビューの検証計画を立案し、永続化する
tags:
  - trigger: plan-sprint-review, plan-review, create-review, schedule-review
  - category: management
---

# plan-sprint-review

スプリント終了時にPOが各PBIのAC達成状況を検証するための**検証計画書**を作成する。
本スキルはPBI/WPごとに全ACを ❔
未確認で列挙した検証台帳を生成し、各ACに検証方法を紐付けることで、レビュー実施時に何を・どのように確認すべきかを明確にする。

## Quick-Start

### Step 1: 検証計画の準備

スプリント開始時に定義したPBIとWPの内容から、各ACの検証方法を決定する。
[references/reference.md](/.agents/skills/bundles/management-bundle/plan-sprint-review/references/reference.md)
に沿って、PBI/WP/ACの一覧と検証方法をJSONにまとめる。

### Step 2: dry-run で検証計画を確認

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-review/scripts/plan_sprint_review.ts --dry-run
```

出力される検証台帳の内容を確認し、全ACが網羅されているかPOと合意する。

### Step 3: 検証計画を確定する

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-review/scripts/plan_sprint_review.ts
```

## 詳細手順

検証計画の立案に必要な入力JSONの形式、実行例、および生成される検証台帳の内容は
[references/reference.md](/.agents/skills/bundles/management-bundle/plan-sprint-review/references/reference.md)
を参照すること。

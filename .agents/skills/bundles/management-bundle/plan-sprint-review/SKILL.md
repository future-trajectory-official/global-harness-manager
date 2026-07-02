---
name: plan-sprint-review
description: スプリントレビューの計画を立案し、永続化する
tags:
  - trigger: plan-sprint-review, plan-review, create-review, schedule-review
  - category: management
---

# plan-sprint-review

スプリント終了時にPOがPBIの達成状況を検証・承認するためのレビュー計画を立案し、情報を永続化する。本スキルはレビューの「枠組み」を作成するまでを担当し、個別ACの成否判定や総合評価の記録は別スキル（`execute-sprint-review`）が担う。

## Quick-Start

### Step 1: レビュー対象スプリントの確認

[references/reference.md > スプリントレビュー計画の立案手順](/.agents/skills/bundles/management-bundle/plan-sprint-review/references/reference.md)
に沿って、レビュー対象のスプリント番号を確認する。

### Step 2: dry-run で計画内容を確認

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-review/scripts/plan_sprint_review.ts --dry-run
```

どのような情報が記録されるかを確認し、POと合意する。

### Step 3: レビュー計画を確定する

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-review/scripts/plan_sprint_review.ts
```

## 詳細手順

レビュー計画の立案に必要な入力値の説明、実行例、および出力内容の解説は
[references/reference.md](/.agents/skills/bundles/management-bundle/plan-sprint-review/references/reference.md)
を参照すること。

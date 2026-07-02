---
name: plan-sprint-review
description: スプリントレビューIssueを計画し、GitHubに作成する
tags:
  - trigger: plan-sprint-review, plan-review, create-review, schedule-review
  - category: management
---

# plan-sprint-review

指定されたスプリント番号に対応する Review Issue（`type:Review`）を GitHub 上に作成する。

## 制約

- 本スキルは Review Issue
  の作成のみを行う。レビュー内容の記録（report）やクローズ（archive）は担当外。

## Quick-Start

### Step 1: 入力JSONの組み立て

[references/reference.md > 入力 JSON の形式](/.agents/skills/bundles/management-bundle/plan-sprint-review/references/reference.md)
に沿って、最低限 `sprintNumber` を含む JSON を準備する。

### Step 2: dry-run で Plan を確認

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-review/scripts/plan_sprint_review.ts --dry-run
```

出力される Plan の各 Step を確認し、意図通りの操作か検証する。

### Step 3: 本実行

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-review/scripts/plan_sprint_review.ts
```

## 詳細手順

入力 JSON 形式、実行例、出力例、エラーハンドリングの詳細は
[references/reference.md](/.agents/skills/bundles/management-bundle/plan-sprint-review/references/reference.md)
を参照すること。

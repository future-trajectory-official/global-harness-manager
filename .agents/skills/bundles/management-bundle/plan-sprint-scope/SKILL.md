---
name: plan-sprint-scope
description: POと対話しながらスプリントスコープを選定・確定する。既存PBI検索、新規PBI発案、サイズ見積り、スプリントへのコミットを1つの業務フローとして提供する。
tags:
  - trigger: plan-sprint-scope
  - trigger: sprint-planning
  - trigger: define-sprint-scope
  - category: management
---

# plan-sprint-scope

スプリントプランニングの文脈でPOと対話しながら、今回のスプリントに含めるPBIを選定・確定する。各操作の入力形式と実行コマンドは
[references/reference.md](/.agents/skills/bundles/management-bundle/plan-sprint-scope/references/reference.md)
を参照。

## 操作スクリプト

| 操作           | スクリプト             | 用途                                                         |
| -------------- | ---------------------- | ------------------------------------------------------------ |
| PBI検索        | `search_pbi.ts`        | 既存PBIをスプリント番号・ステータスで検索（keywordは未実装） |
| PBI発案        | `propose_pbi.ts`       | 新規PBIをIdea状態でIssue作成                                 |
| サイズ見積り   | `estimate_pbi_size.ts` | PBIのサイズ（XS/S/M/L/XL）を記録                             |
| ステータス進行 | `advance_status.ts`    | PBI/WPのステージを現在値から自動判定して1段階進める          |

## 制約

- 各操作のJSON入力形式と必須フィールドは
  [references/reference.md](/.agents/skills/bundles/management-bundle/plan-sprint-scope/references/reference.md)
  で確認すること。
- `--dry-run` でPlan内容を確認してから本実行に移ること。

## Quick-Start

### Step 1: PBI検索（候補確認）

[search_pbi.ts の入力](/.agents/skills/bundles/management-bundle/plan-sprint-scope/references/reference.md#search_pbits--pbi検索)
を参考に、既存PBIを条件検索する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-scope/scripts/search_pbi.ts
```

<!-- STOP -->

### Step 2: PBI発案（新規立案）

候補にないPBIが必要な場合、
[propose_pbi.ts の入力](/.agents/skills/bundles/management-bundle/plan-sprint-scope/references/reference.md#propose_pbits--pbi発案)
に従い発案する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-scope/scripts/propose_pbi.ts --dry-run
```

ユーザー承認後に `--dry-run` を外して本実行。

<!-- STOP -->

### Step 3: サイズ見積り

各PBIに
[estimate_pbi_size.ts の入力](/.agents/skills/bundles/management-bundle/plan-sprint-scope/references/reference.md#estimate_pbi_sizets--サイズ見積り)
でサイズを設定する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-scope/scripts/estimate_pbi_size.ts
```

<!-- STOP -->

### Step 4: スプリントへ確定

[advance_status.ts の入力](/.agents/skills/bundles/management-bundle/plan-sprint-scope/references/reference.md#advance_statusts--ステータス進行)
でPBIを Idea→Todo に進める。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-scope/scripts/advance_status.ts --dry-run
```

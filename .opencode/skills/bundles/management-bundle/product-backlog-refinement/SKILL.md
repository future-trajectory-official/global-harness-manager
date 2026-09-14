---
name: product-backlog-refinement
description: プロダクトオーナーと対話しながら、バックログの精査、優先順位付け、およびPBIの確定を行う。
tags:
  - trigger: product-backlog-refinement
  - trigger: backlog-refinement
  - trigger: prioritize-pbi
  - category: management
---

# product-backlog-refinement

スプリントプランニングの文脈でPOと対話しながら、今回のスプリントに含めるPBIを選定・確定する。各操作の入力形式と実行コマンドは
[references/reference.md](/.agents/skills/bundles/management-bundle/product-backlog-refinement/references/reference.md)
を参照。PBIの深掘りディスカッションの進め方は
[references/pbi-deep-dive.md](/.agents/skills/bundles/management-bundle/product-backlog-refinement/references/pbi-deep-dive.md)
を参照。

## 操作スクリプト

| 操作         | スクリプト             | 用途                                                         |
| ------------ | ---------------------- | ------------------------------------------------------------ |
| PBI検索      | `search_pbi.ts`        | 既存PBIをスプリント番号・ステータスで検索（keywordは未実装） |
| PBI発案      | `propose_pbi.ts`       | 新規PBIをIdea状態でIssue作成                                 |
| サイズ見積り | `estimate_pbi_size.ts` | PBIのサイズ（XS/S/M/L/XL）を記録                             |
| PBI更新      | `update_pbi.ts`        | PBIのサマリー・成果物・証明方法を更新する                    |

## 制約

- 各操作のJSON入力形式と必須フィールドは
  [references/reference.md](/.agents/skills/bundles/management-bundle/product-backlog-refinement/references/reference.md)
  で確認すること。
- `--dry-run` でPlan内容を確認してから本実行に移ること。

## Quick-Start

### Step 1: PBI検索（候補確認）

[search_pbi.ts の入力](/.agents/skills/bundles/management-bundle/product-backlog-refinement/references/reference.md#search_pbits--pbi検索)
を参考に、既存PBIを条件検索する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/search_pbi.ts
```

<!-- STOP -->

### Step 2: PBI発案（新規立案）

候補にないPBIが必要な場合、
[propose_pbi.ts の入力](/.agents/skills/bundles/management-bundle/product-backlog-refinement/references/reference.md#propose_pbits--pbi発案)
に従い発案する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/propose_pbi.ts --dry-run
```

ユーザー承認後に `--dry-run` を外して本実行。

<!-- STOP -->

### Step 3: サイズ見積り

各PBIに
[estimate_pbi_size.ts の入力](/.agents/skills/bundles/management-bundle/product-backlog-refinement/references/reference.md#estimate_pbi_sizets--サイズ見積り)
でサイズを設定する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/estimate_pbi_size.ts
```

<!-- STOP -->

### Step 4: PBI更新

[update_pbi.ts の入力](/.agents/skills/bundles/management-bundle/product-backlog-refinement/references/reference.md#update_pbits--pbi更新)
でPBIのサマリー・成果物・証明方法を更新する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/product-backlog-refinement/scripts/update_pbi.ts --dry-run
```

---
name: record-pbi-effort-analysis
description: スプリント終了時にPBI配下の全WPのeffort（initial/planned/actual）を集計し、effort乖離分析をPBIに記録する。
tags:
  - trigger: record-pbi-effort-analysis
  - trigger: record-pbi-analysis
  - trigger: sprint-end
  - category: management
---

# record-pbi-effort-analysis

スプリント終了時、対象PBI配下の全WPのeffort（initial / planned / actual）を集計し、
AIが乖離分析（planning / execution / improvement）を実施して対象PBIに記録します。

## 前提条件

- 対象PBIがプロダクトバックログに存在していること
- PBI配下のWPのeffort情報（initial / planned / actual）が記録されていること

## Quick-Start

```bash
# dry-run: 集計Planを確認
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-effort-analysis/scripts/record_pbi_effort_analysis.ts --dry-run

# 実実行: 集計＋乖離分析の記録
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-effort-analysis/scripts/record_pbi_effort_analysis.ts
```

## 手順

### 1. WP effort集計

- 対象PBI配下の全WPの initial / planned / actual を集計する。

### 2. effort乖離分析

- 集計結果から AI が以下を分析する:
  - **planning（計画乖離）**: 初期見積（initial）vs 計画見積（planned）の乖離要因
  - **execution（実行乖離）**: 計画見積（planned）vs 実績（actual）の乖離要因
  - **improvement（改善提案）**: 次スプリントへの具体的な改善策

### 3. 記録

- 集計値（`wp_effort_summary`）と分析結果（planning / execution / improvement）を対象PBIに記録する。
- 集計値は `harness-effort-summary`、分析結果は各 `harness-variance-review-*`
  フィールドに記録される。

### 4. 対話パターン

1. AI: dry-run で集計Planを提示し、PO確認を得る
2. AI: `analyzeEffort`
   を実実行して集計値（`output.wp_effort_summary`）を取得し、乖離分析ドラフトとともに提示する
3. AI: 集計値を `effortSummary` として入力に含め、`recordAnalysis` で記録し、結果をPOに報告する
   - 記録時は `effortSummary` 必須（`harness-effort-summary` への記録を保証するため）

## 詳細リファレンス

- 入力JSON形式・スクリプト呼出パターンは
  [references/reference.md](/.agents/skills/bundles/management-bundle/record-pbi-effort-analysis/references/reference.md)
  を参照

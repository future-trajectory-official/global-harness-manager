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

- 分析結果（planning / execution / improvement）を対象PBIに記録する。

### 4. 対話パターン

1. AI: dry-run で集計Planを提示し、PO確認を得る
2. AI: 集計値と乖離分析ドラフトを提示し、POの調整・承認を得る
3. AI: recordAnalysis で記録し、結果をPOに報告する

## 詳細リファレンス

- 入力JSON形式・スクリプト呼出パターンは
  [references/reference.md](/.agents/skills/bundles/management-bundle/record-pbi-effort-analysis/references/reference.md)
  を参照

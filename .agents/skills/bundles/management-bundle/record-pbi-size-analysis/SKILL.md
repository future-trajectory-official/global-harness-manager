---
name: record-pbi-size-analysis
description: スプリント終了時にPBIの実感サイズ（size_actual）とサイズ乖離理由（variance-review-size）をPBIに記録する。
tags:
  - trigger: record-pbi-size-analysis
  - trigger: record-size-analysis
  - trigger: sprint-end
  - category: management
---

# record-pbi-size-analysis

スプリント終了時、対象PBIの実感サイズ（size_actual）を確定し、見積サイズとの乖離理由を対象PBIに記録します。

## 前提条件

- 対象PBIがプロダクトバックログに存在していること
- PBIの見積サイズが記録されていること

## Quick-Start

```bash
# dry-run: confirmSize の Plan を確認
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-size-analysis/scripts/record_pbi_size_analysis.ts --dry-run

# 実実行: size_actual + variance_reason を記録
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-size-analysis/scripts/record_pbi_size_analysis.ts
```

## 手順

### 1. 見積サイズの取得

- 対象PBIの見積サイズを確認する。

### 2. 実績サイズの提案と対話

- AIがセッション履歴等から実感サイズ（size_actual）を提案し、乖離理由（variance_reason）を整理する。
- **実感サイズの判断基準**:
  実労力（介入回数）ではなく、PBIの実際の複雑さ・設計判断・アーキテクチャ変更の度合いに基づく。サイズ定義と判断基準は
  [backlog-guidelines.md 2.2](/guides/backlog-guidelines.md) を参照（effort とは別概念）。
- POと調整し、最終値を確定する。

### 3. PO承認と記録

- 確定した size_actual と乖離理由を対象PBIに記録する。

### 4. 対話パターン

1. AI: 見積サイズと提案する実績サイズ・乖離理由を提示し、POの調整・承認を得る
2. AI: confirmSize で記録し、結果をPOに報告する

## 詳細リファレンス

- 入力JSON形式・スクリプト呼出パターンは
  [references/reference.md](/.agents/skills/bundles/management-bundle/record-pbi-size-analysis/references/reference.md)
  を参照

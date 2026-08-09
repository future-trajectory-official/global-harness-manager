---
name: record-sprint-velocity
description: スプリント終了時に、該当スプリントのベロシティ集計（完了PBI数・合計ウェイト・見積一致率・サマリ）をスプリントのベロシティ情報として記録する。
tags:
  - trigger: record-sprint-velocity
  - trigger: sprint-end
  - category: management
---

# record-sprint-velocity

スプリント終了時、対象スプリントのベロシティ集計値をスプリントのベロシティ情報として記録します。

## 前提条件

- 対象スプリントがスプリントバックログに存在し、現在進行中であること
- PBIの実績サイズ（size_actual）が記録済みであること

## Quick-Start

```bash
# dry-run: recordVelocity の Plan を確認（最新のオープンスプリントを自動解決）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-sprint-velocity/scripts/record_sprint_velocity.ts --dry-run

# 実実行
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-sprint-velocity/scripts/record_sprint_velocity.ts
```

## 手順

### 1. ベロシティ集計

- 対象スプリント（最新のオープンスプリント）に含まれる完了PBIの `size_actual`
  を収集し、以下の値を集計する。
  - `pbiCount`: 完了PBI数
  - `totalWeight`: size_actual のウェイト合計（XS=1 / S=2 / M=3 / L=5 / XL=8）
  - `matchRate`: 見積一致率（estimate と actual が一致したPBI数 ÷ 全体）
  - `summary`: 数値で説明しきれない文脈・留意点

> **WEIGHT_MAP**（旧スキル record-velocity からの import 禁止。本スキル内で独立定義） XS=1, S=2,
> M=3, L=5, XL=8
>
> **対象スプリントの解決**: スクリプトは引数なし `find()`
> で最新のオープンスプリント（Milestone）を自動解決する。入力に identifier / sprintNumber は不要。

### 2. PO確認と記録

- AIが集計結果をPOに提示し、承認を得る。
- 承認後、スプリントのベロシティセクションを更新する。

### 3. 対話パターン

1. AI: 集計したベロシティ数値をPOに提示し、確認・調整を得る
2. AI: recordVelocity で記録し、結果をPOに報告する

## 詳細リファレンス

- 入力JSON形式・スクリプト呼出パターンは
  [references/reference.md](/.agents/skills/bundles/management-bundle/record-sprint-velocity/references/reference.md)
  を参照

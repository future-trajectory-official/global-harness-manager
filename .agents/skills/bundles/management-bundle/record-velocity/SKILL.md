---
name: record-velocity
description: スプリント終了時に実績データを集計し、ベロシティ情報をバックログの実績推移テーブルに追記する。
tags:
  trigger:
    - sprint-end
    - record-velocity
  category: management
---

# record-velocity

アーカイブされたPBIの実績データから合計ウェイト・実感サイズ一致率・乖離要約を自動集計し、`product-backlog.md`
の「スプリント実績推移」テーブルに追記します。

## 前提条件

- 対象スプリントの全PBIが `product-backlog-archive.md` にアーカイブ済みであること
- `product-backlog.md` に「スプリント実績推移」テーブルが存在すること

## Quick-Start

```bash
# 実績集計（Sprint 5）
deno run -A .agents/skills/bundles/management-bundle/record-velocity/scripts/record_velocity.ts --sprint "Sprint 5"

# ドライラン（書き込みなしでプレビュー）
deno run -A .agents/skills/bundles/management-bundle/record-velocity/scripts/record_velocity.ts --sprint "Sprint 5" --dry-run
```

## 手順

### 1. アーカイブの読み取り

- `product-backlog-archive.md` を読み取り、指定スプリントの全PBIブロックを抽出する

### 2. メトリクスの算出

- 各PBIの見積サイズ・実感サイズをパースし、以下の値を計算する:
  - **開発PBI数**: 該当スプリントのPBI数
  - **合計ウェイト**: 見積サイズからウェイトマッピング（XS=1, S=2, M=3, L=5, XL=8）で総和
  - **実感サイズ一致率**: 見積＝実感のPBI数 / 全PBI数
  - **乖離要約**: 乖離があったPBIの一覧と乖離パターンを要約

### 3. テーブル更新

- `product-backlog.md` の「スプリント実績推移」テーブルを特定し、新規行を追記する
- `--dry-run` フラグで書き込み前に内容を確認可能

### 4. コミット

- テーブル更新後、`docs: record velocity for <sprint-name>` としてコミットを提案する

## 詳細リファレンス

- 集計ロジックの詳細は
  [velocity-algorithm.md](/.agents/skills/bundles/management-bundle/record-velocity/references/velocity-algorithm.md)
  を参照
- 予実差分析のデータモデル詳細は
  [variance-analysis-data-model.md](/.agents/skills/bundles/management-bundle/record-velocity/references/variance-analysis-data-model.md)
  を参照

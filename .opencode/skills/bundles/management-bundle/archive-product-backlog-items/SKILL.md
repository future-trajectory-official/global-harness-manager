---
name: archive-product-backlog-items
description: スプリント終了時に、完了済みのWPとPBIをアーカイブする。WP→PBIの順で実行する。
tags:
  - trigger: archive-product-backlog-items
  - trigger: archive-backlog-items
  - trigger: sprint-end
  - category: management
---

# archive-product-backlog-items

スプリント終了時、完了済みのWPとPBIをアーカイブします。 **アーカイブ順序は WP →
PBI**（子先にアーカイブ）です。

## 前提条件

- アーカイブ対象のPBI/WPが完了状態（`[DONE]`）であること
- 既にアーカイブ済みの場合はエラーとなる

## Quick-Start

```bash
# dry-run: archive の Plan を確認
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/archive-product-backlog-items/scripts/archive_wp.ts --dry-run

# 実実行: WPをアーカイブ
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/archive-product-backlog-items/scripts/archive_wp.ts

# 実実行: PBIをアーカイブ
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/archive-product-backlog-items/scripts/archive_pbi.ts
```

## 手順

### 1. アーカイブ対象の特定と提示

- スプリント内の完了済み（`[DONE]`）PBI/WP を一覧でPOに提示する。
- アーカイブ対象に漏れがないかPOと確認する。

### 2. アーカイブ順序の確定

- **アーカイブ順序は WP → PBI**（子先にアーカイブ）を原則とする。
- POが順序・対象を承認したら次に進む。

### 3. 順次アーカイブ

- WPをアーカイブし、続けてPBIをアーカイブする。
- 各ステップの結果をPOに報告しながら進める。

### 4. 対話パターン

1. AI: アーカイブ対象一覧と順序（WP→PBI）を提示 → PO確認
2. PO承認 → 順次アーカイブ → 結果を報告

## 詳細リファレンス

- 入力JSON形式・スクリプト呼出パターンは
  [references/reference.md](/.agents/skills/bundles/management-bundle/archive-product-backlog-items/references/reference.md)
  を参照

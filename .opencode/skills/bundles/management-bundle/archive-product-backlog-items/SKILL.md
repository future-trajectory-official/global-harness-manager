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

> [!WARNING]
> **ProjectV2 の Status と Issue state は別物**
>
> `Done` は ProjectV2 の Status であり、Issue が `open` であることを意味しない。
> 本スキルの対象は「**open かつ Status=Done**」に限る。`read-project-state` の `search` は Status
> で絞り込むが Issue state を返さないため、対象確認には次のいずれかを用いること。
>
> - `find` の `issueState`（`OPEN` / `CLOSED`）を確認する
> - 対象スプリント（Milestone）で絞り込む
>
> **PR本文のクローズキーワード（`Closes #N` 等）で Issue が自動 CLOSED になっている場合**は、 Status
> が `Done` でも本スキルの対象外となる。`complete-work-package` 実行前に Issue が OPEN
> であることを確認し、意図しない CLOSED は POの判断で `gh issue reopen` により復帰させること
> （`create-pull-request` の手順4・`merge-branch` の手順7を参照）。

## Quick-Start

```bash
# dry-run: archive の Plan を確認
echo '<JSON>' | deno run -A .opencode/skills/bundles/management-bundle/archive-product-backlog-items/scripts/archive_wp.ts --dry-run

# 実実行: WPをアーカイブ
echo '<JSON>' | deno run -A .opencode/skills/bundles/management-bundle/archive-product-backlog-items/scripts/archive_wp.ts

# 実実行: PBIをアーカイブ
echo '<JSON>' | deno run -A .opencode/skills/bundles/management-bundle/archive-product-backlog-items/scripts/archive_pbi.ts
```

## 手順

### 1. アーカイブ対象の特定と提示

- スプリント内の完了済み（`[DONE]`）PBI/WP を一覧でPOに提示する。
- **対象スプリント（Milestone）で絞り込み**、Issue state が `OPEN` のものだけを対象とする。
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
  [references/reference.md](/.opencode/skills/bundles/management-bundle/archive-product-backlog-items/references/reference.md)
  を参照

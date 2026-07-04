---
name: revise-sprint-review
description: スプリントレビュー計画と現在のバックログの差分を PO と確認しながら改訂する
tags:
  - trigger: revise-sprint-review, revise-review, update-review, amend-review
  - category: management
---

# revise-sprint-review

スプリント中に発生した仕様変更や追加 AC に対し、`plan-sprint-review` で作成した Review Issue
の検証計画を改訂する。 本スキルは **PO と PBI → WP → AC の階層で逐次対話** し、削除 AC / 追加 AC /
変更理由を確定した上で、**1回の `revise` 操作で Review Issue を更新する**。

## Quick-Start

### Step 1: 対象の Review Issue を取得する

`examine` サブコマンドで現在の Review Issue を特定し、本文を取得する。

```bash
echo '{"sprintNumber": 17}' | deno run -A .agents/skills/bundles/management-bundle/revise-sprint-review/scripts/revise_sprint_review.ts examine
```

出力された本文をもとに、PO と現在の検証計画を確認する。

### Step 2: PO と対話して変更点を確定する

[references/reference.md](/.agents/skills/bundles/management-bundle/revise-sprint-review/references/reference.md)
に沿って、PBI → WP → AC の順に PO と対話し、以下を確定する：

- 削除する AC（仕様変更や不要になったもの）
- 追加する AC（スプリント中に発生した追加検証項目）
- 各変更の理由

<!-- STOP -->

### Step 3: 確定した変更点を JSON にまとめ、dry-run で確認 → PO承認 → 本実行

```bash
# dry-run
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/revise-sprint-review/scripts/revise_sprint_review.ts revise --dry-run

# 本実行（PO承認後）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/revise-sprint-review/scripts/revise_sprint_review.ts revise
```

## 詳細手順

入力 JSON の形式、PO 対話フロー、dry-run 出力の解釈、エラーハンドリング、巻き戻し手順は
[references/reference.md](/.agents/skills/bundles/management-bundle/revise-sprint-review/references/reference.md)
を参照すること。

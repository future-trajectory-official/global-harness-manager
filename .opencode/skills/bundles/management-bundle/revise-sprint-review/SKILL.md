---
name: revise-sprint-review
description: スプリントレビュー計画と現在のバックログの差分を PO と確認しながら改訂する
tags:
  - trigger: revise-sprint-review
  - trigger: revise-review
  - trigger: update-review
  - trigger: amend-review
  - category: management
---

# revise-sprint-review

スプリント中に発生した仕様変更や追加 AC に対し、`plan-sprint-review` で作成した Review
の検証計画を改訂する。本スキルは **PO と Review の AC を 1 つずつ確認** し、スプリントゴールおよび
PBI Body との意味的なカバレッジのずれを確定した上で、domain 層の `ReviewUseCase.revise` を呼び出して
Plan を生成し、永続化層へ反映する。

## Quick-Start

### Step 1: 対象の Review を取得する（PO には全文を表示しない）

`examine` サブコマンドで Review Issue を特定し、現在の検証計画を取得する。取得した本文は AI
が内部で保持し、PO に一気に表示して確認負荷をかけてはいけない。

```bash
deno run -A .agents/skills/bundles/management-bundle/revise-sprint-review/scripts/revise_sprint_review.ts examine
```

<!-- STOP -->

### Step 2: Review の AC を 1 つずつ PO と確認する

[references/reference.md](/.agents/skills/bundles/management-bundle/revise-sprint-review/references/reference.md)
に沿って、以下の流れで PO と対話する：

1. スプリントゴールと各 PBI の内容（`read-project-state` スキル等で取得）を確認材料として保持する。
2. Review の AC を **1 つずつ** PO に提示し、「この AC はスプリントゴール / PBI Body
   のどの部分を検証するか」を説明する。
3. PO と認識のずれやカバレッジ不足がないか確認する。
4. 不要になった AC、追加が必要な AC、変更理由を確定する。

<!-- STOP -->

### Step 3: 確定した変更点を JSON にまとめ、dry-run で確認 → PO 承認 → 本実行

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

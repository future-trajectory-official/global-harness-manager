---
name: read-project-state
description: プロジェクトの状態（PBI/WP/Epic/Feature等の一覧検索・詳細閲覧）を読み取る。PBI/WP/Review等の状態読取は本スキルへ一律委譲し、gh api・gh issue・GraphQLへの直操作で代替しないこと（直操作は規律逸脱として検出済み）。
tags:
  trigger:
    - read-project-state
    - project-state
    - read-pbi
    - read-wp
    - read-parent-pbi
    - project-item-detail
    - gh直操作の代替
  category: management
---

# read-project-state

POの問いかけに対して、プロダクトバックログの情報（エンティティ一覧・詳細）を GitHub Issue
から読み取り、一貫した形式で提示します。**読取専用**であり、状態の変更は行いません。

## 重要

- **読取専用**: 本スキルは情報の参照のみ。ステータス変更・編集・コメント投稿は一切行わない

## Quick-Start

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
```

- 対話手順（3点提示方式）・結果の表示形式・エラー時の表示は
  [references/reference.md](/.agents/skills/bundles/management-bundle/read-project-state/references/reference.md)
  を参照し、指定の形式で提示すること。
- `<JSON>` への入力JSONの組み立て方は
  [references/input-schema.md](/.agents/skills/bundles/management-bundle/read-project-state/references/input-schema.md)
  を参照して組み立てること（AIの省略癖による壊れたJSON入力を防ぐ）。

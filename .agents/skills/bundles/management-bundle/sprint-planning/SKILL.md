---
name: sprint-planning
description: スプリントで開発する機能群について、詳細タスクへ分解し、実装可能な状態にプランニングを行う。
tags:
  - trigger: sprint-planning
  - trigger: plan-sprint
  - trigger: commit-pbi
  - category: management
---

# sprint-planning

プロダクトバックログリファインメントで確定したPBIをスプリントにコミットする。入力形式と実行コマンドの詳細は
[reference.md](/.agents/skills/bundles/management-bundle/sprint-planning/reference.md) を参照。

## 操作スクリプト

| 操作        | スクリプト      | 用途                      |
| ----------- | --------------- | ------------------------- |
| PBIコミット | `commit_pbi.ts` | PBIをスプリントに確定する |

## 制約

- JSON入力形式と必須フィールドは
  [reference.md](/.agents/skills/bundles/management-bundle/sprint-planning/reference.md)
  で確認すること。
- `--dry-run` でPlan内容を確認してから本実行に移ること。

## Quick-Start

### Step 1: PBIコミット

PBIのステータスを Idea→Todo に進行し、スプリントに確定する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/sprint-planning/scripts/commit_pbi.ts --dry-run
```

ユーザー承認後に `--dry-run` を外して本実行。

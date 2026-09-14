---
name: define-work-package
description: スプリントに確定したPBIをWPに分解し、作成・初期見積り・確定を行う。
tags:
  - trigger: define-work-package
  - trigger: define-wp
  - trigger: create-work-package
  - category: management
---

# define-work-package

PBIのタスク分解としてWPを作成し、初期見積りを記録する。入力形式と実行コマンドの詳細は
[references/reference.md](/.agents/skills/bundles/management-bundle/define-work-package/references/reference.md)
を参照。

## 操作スクリプト

| 操作       | スクリプト                      | 用途                                    |
| ---------- | ------------------------------- | --------------------------------------- |
| WP作成     | `define_wp.ts`                  | 親PBIに紐付くWPを作成。AC項目も同時設定 |
| 初期見積り | `estimate_wp_initial_effort.ts` | WPに計画前effortを見積もる              |
| WPコミット | `commit_wp.ts`                  | WPをIdea→Todoに進行しスプリントへ確定   |

## 制約

- 各操作のJSON入力形式と必須フィールドは
  [references/reference.md](/.agents/skills/bundles/management-bundle/define-work-package/references/reference.md)
  で確認すること。
- `--dry-run` でPlan内容を確認してから本実行に移ること。

## Quick-Start

### Step 1: WP作成

[define_wp.ts の入力](/.agents/skills/bundles/management-bundle/define-work-package/references/reference.md#define_wpts--wp作成)
を参考に、親PBIに紐付くWPを作成する。AC項目も同時に指定する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/define_wp.ts --dry-run
```

ユーザー承認後に `--dry-run` を外して本実行。

<!-- STOP -->

### Step 2: 初期見積り

[estimate_wp_initial_effort.ts の入力](/.agents/skills/bundles/management-bundle/define-work-package/references/reference.md#estimate_wp_initial_effortts--初期見積り)
を参考に、各WPに初期見積りを設定する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/estimate_wp_initial_effort.ts --dry-run
```

ユーザー承認後に `--dry-run` を外して本実行。

<!-- STOP -->

### Step 3: WPコミット

各WPのステータスを Idea→Todo に進行し、スプリントに確定する。

[commit_wp.ts の入力](/.agents/skills/bundles/management-bundle/define-work-package/references/reference.md#commit_wpts--wpコミット)
を参考に、各WPをコミットする。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/commit_wp.ts --dry-run
```

ユーザー承認後に `--dry-run` を外して本実行。

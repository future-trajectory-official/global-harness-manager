---
name: refine-acceptance-criteria
description: 既存のWPに対して受入基準（AC）を一括定義・更新する。AC定義フェーズで利用する。
tags:
  - trigger: refine-acceptance-criteria
  - trigger: define-acceptance-criteria
  - trigger: wp-ac
  - category: management
---

# refine-acceptance-criteria

開発完了の検証条件としてACを定義する。PBI配下の全WPに対してACを一括書き込みする。入力形式と実行コマンドの詳細は
[references/reference.md](/.agents/skills/bundles/management-bundle/refine-acceptance-criteria/references/reference.md)
を参照。

## 操作スクリプト

| 操作       | スクリプト                         | 用途                            |
| ---------- | ---------------------------------- | ------------------------------- |
| AC一括定義 | `define_wp_acceptance_criteria.ts` | PBI配下の全WPへACを一括書き込み |

## 制約

- JSON入力形式と必須フィールドは
  [references/reference.md](/.agents/skills/bundles/management-bundle/refine-acceptance-criteria/references/reference.md)
  で確認すること。
- `--dry-run` でPlan内容を確認してから本実行に移ること。

## Quick-Start

### Step 1: AC一括定義

[define_wp_acceptance_criteria.ts の入力](/.agents/skills/bundles/management-bundle/refine-acceptance-criteria/references/reference.md#define_wp_acceptance_criteriats--ac一括定義)
を参考に、PBI配下の全WPにACを書き込む。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/refine-acceptance-criteria/scripts/define_wp_acceptance_criteria.ts --dry-run
```

ユーザー承認後に `--dry-run` を外して本実行。

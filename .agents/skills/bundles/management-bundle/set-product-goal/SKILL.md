---
name: set-product-goal
description: プロダクトゴールを定義し、永続化する。kickoffワークフローから呼び出される。
tags:
  - trigger: set-product-goal, define-goal, kickoff-set-goal, kickoff-phase2
  - category: management
---

# set-product-goal

プロダクトゴール（いつまでに何を達成するか）を定義し、永続化する。
対話によるゴール定義プロセスと、スクリプト経由の永続化を組み合わせる。

> **注意**: エピック/フィーチャー構造の作成は本スキルの対象外。別スキルで扱う。

## 制約

- Quick-Start の各 Step 間でユーザーの回答を待つこと（先読みして次に進まない）
- 対話中はユーザーの発言を要約してから次の質問に移ること
- 既存のProductGoalが存在する場合は本スキルではなく `assess-goal-continuation` のpivotを使用すること

## Quick-Start

### Step 1: ゴール要素の収集（対話）

ユーザーとの対話を通じてプロダクトゴールを具体化する。

- **問いかけ例**: 「3〜6ヶ月後に『達成できたら確かな一歩』と感じられるのはどんな状態でしょうか？」
- 「それはどうなったら『達成』と言えますか？」
- ゴールはアウトカム（状態の変化）で表現し、「機能Xを作る」ではなく「ユーザーがYできるようになる」とする

<!-- STOP -->

### Step 2: 確定と実行

収集したゴールを入力JSONにマッピングし、dry-runで内容確認 → ユーザー承認 → 本実行の順で進める。

```bash
# dry-run（事前確認）
echo '{"description":"<ゴールの記述>"}' | deno run -A .agents/skills/bundles/management-bundle/set-product-goal/scripts/set_product_goal.ts --dry-run

# 本実行（ユーザー承認後）
echo '{"description":"<ゴールの記述>"}' | deno run -A .agents/skills/bundles/management-bundle/set-product-goal/scripts/set_product_goal.ts
```

入力JSONの詳細は
[references/reference.md](/.agents/skills/bundles/management-bundle/set-product-goal/references/reference.md)
を参照。

## 詳細手順

### Phase 1: ゴール定義の対話

1. **最初の一歩の特定**: ビジョン全体ではなく、最初に手に入れたい状態を絞り込む
2. **解像度を上げる**: 「どう測定できるか」を問い、あいまいなゴールを研ぎ澄ませる
3. **ゴールの確定**: ユーザーが納得できる形でゴール文を確定する

### Phase 2: 永続化の実行

1. 確定したゴールを入力JSONにマッピングする
2. dry-runでPlan内容を確認し、ユーザーに提示する
3. ユーザーの承認を得た後、本実行で永続化する
4. 永続化結果（Issue情報）をユーザーに提示する

## 入力JSON形式

入力JSONの詳細な形式と各フィールドの説明は
[references/reference.md](/.agents/skills/bundles/management-bundle/set-product-goal/references/reference.md)
を参照すること。

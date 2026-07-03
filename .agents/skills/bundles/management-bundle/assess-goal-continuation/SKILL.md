---
name: assess-goal-continuation
description: プロダクトゴールの継続性を評価する。9割は確認のみで終了し、1割でピボットを実行する。sprint-startワークフローから呼び出される。
tags:
  - trigger: assess-goal-continuation, review-goal, pivot-goal, goal-check
  - category: management
---

# assess-goal-continuation

現在のプロダクトゴールを確認し、継続するかピボットするかを評価する。
9割のケースでは確認のみで終了し、ピボットが実行されるのは例外的。

> **注意**: Visionの方針転換も起こりえるが、本スキルの現バージョンではProductGoalのみを対象とする。
> 将来のsprint-start Phase 0統合時にVision確認も含める予定。

## 制約

- 各Step間でユーザーの回答を待つこと（先読みして次に進まない）
- ピボットの実行はdry-runで内容確認 → ユーザー承認 → 本実行の順で行うこと
- ProductGoalが存在しない場合はエラーになる。先に `set-product-goal` で作成すること

## Quick-Start

```bash
# 確認フェーズ（現状取得）
echo '{"title":"Product Goal"}' | deno run -A .agents/skills/bundles/management-bundle/assess-goal-continuation/scripts/assess_goal_continuation.ts --dry-run

# 更新フェーズ（ピボットdry-run）
echo '{"title":"Product Goal","pivot":{"description":"New goal","reason":"Changed direction","code":"42"}}' | deno run -A .agents/skills/bundles/management-bundle/assess-goal-continuation/scripts/assess_goal_continuation.ts --dry-run
```

入力JSONの詳細は
[references/reference.md](/.agents/skills/bundles/management-bundle/assess-goal-continuation/references/reference.md)
を参照。

## 詳細手順

### Step 1: 現在のProductGoalを取得（確認フェーズ）

現在のProductGoalを検索・取得し、内容をPOに提示する。

```bash
echo '{"title":"Product Goal"}' | deno run -A .agents/skills/bundles/management-bundle/assess-goal-continuation/scripts/assess_goal_continuation.ts
```

出力にはProductGoalの内容と `code`（Issue番号）が含まれる。 後続のピボット実行でこの `code`
を使用する。

<!-- STOP: POが内容を確認し、継続かピボットかを判断する -->

### Step 2: ピボットの場合、新しいゴールと理由をPOと合意（対話）

継続の場合はここで終了（9割のケース）。
ピボットの場合は、新しいゴールの記述と変更理由をPOと合意する。

- **問いかけ例**: 「ゴールをどのように変更しますか？その理由は？」
- 変更理由は履歴テーブルに記録されるため、将来の振り返りで参照できるよう具体的に

<!-- STOP: POが新しいゴールと理由を確定する -->

### Step 3: ピボットのdry-runで更新内容を確認（更新フェーズ）

Step 1の出力から取得した `code` を使用して、ピボットのdry-runを実行する。

```bash
echo '{"title":"Product Goal","pivot":{"description":"<新ゴール>","reason":"<変更理由>","code":"<Step1の出力code>"}}' | deno run -A .agents/skills/bundles/management-bundle/assess-goal-continuation/scripts/assess_goal_continuation.ts --dry-run
```

Plan内容（update + comment の2 Step）を確認する。

<!-- STOP: POがdry-run出力を承認する -->

### Step 4: ピボットを本実行

```bash
echo '{"title":"Product Goal","pivot":{"description":"<新ゴール>","reason":"<変更理由>","code":"<Step1の出力code>"}}' | deno run -A .agents/skills/bundles/management-bundle/assess-goal-continuation/scripts/assess_goal_continuation.ts
```

## 入力JSON形式

入力JSONの詳細な形式と各フィールドの説明は
[references/reference.md](/.agents/skills/bundles/management-bundle/assess-goal-continuation/references/reference.md)
を参照すること。

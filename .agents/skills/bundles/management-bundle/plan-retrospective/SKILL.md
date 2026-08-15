---
name: plan-retrospective
description: スプリント終了時に、対象スプリントの振り返りを作成する。
tags:
  - trigger: plan-retrospective
  - trigger: create-retrospective
  - trigger: sprint-end
  - category: management
---

# plan-retrospective

スプリント終了時に、対象スプリントの**振り返り**を新規作成します。作成した振り返りに、後続の
`record-sprint-kpt`（KPT記録）と
`record-sprint-metrics`（スプリント評価の記録）で内容を記録していきます。

## 前提条件

- 対象スプリントの番号が判明していること
- 対象スプリントの振り返りが未作成であること

## 手順

> [!IMPORTANT] 各ステップの責任者 各ステップの見出しに **責任者** を明記する。
>
> - `[責任者: AI]`: AIが自律実行する（確認不要）
> - `[責任者: PO]`: POが実行する
> - `[責任者: 共同]`: AIが案を提示し、**POの確定を経てから**次のステップへ進む

### Step 1: 対象スプリントの確認 [責任者: 共同]

振り返りを作成するスプリント番号を PO と確認する。

### Step 2: 作成内容の確認 [責任者: 共同]

以下のコマンドで、作成される振り返りの内容（タイトル・本文）を確認する。PO の承認後に次へ進む。
入力JSONの組み立て方は
[references/reference.md](/.agents/skills/bundles/management-bundle/plan-retrospective/references/reference.md)
を参照すること。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-retrospective/scripts/plan_retrospective.ts --dry-run
```

### Step 3: 振り返りの作成 [責任者: AI]

PO の承認後、実実行で振り返りを作成する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/plan-retrospective/scripts/plan_retrospective.ts
```

### Step 4: 結果報告 [責任者: AI]

作成された振り返りの番号とタイトルを PO に報告する。

## 詳細リファレンス

- 入力JSON形式・dry-run 出力の解釈・実行パターンは
  [references/reference.md](/.agents/skills/bundles/management-bundle/plan-retrospective/references/reference.md)
  を参照

---
name: record-sprint-metrics
description: スプリント終了時に、実績とセッション振り返りを確認してスプリントの評価を記録する。
tags:
  - trigger: record-sprint-metrics
  - trigger: record-metrics
  - trigger: sprint-metrics
  - trigger: sprint-end
  - category: management
---

# record-sprint-metrics

スプリント終了時に、スプリント内の実績（完了した作業の規模・労力・ベロシティ）と各セッションの
振り返りを確認し、実績と振り返りに基づいてスプリント全体を評価する5つの指標 （目標達成度 / 見積精度
/ 品質維持 / 協働規律 / ベロシティ）を記録します。

**実績とセッション振り返りの確認なしに記録することを禁止する。** 記録の前に必ず「Step 1:
実績とセッション振り返りの確認」を実施する。

## 前提条件

- 対象スプリントの振り返りが作成済みであること（`plan-retrospective` 実施済み）
- 対象スプリント内の各作業パッケージのセッション振り返り・メトリクスが記録済みであること
- ベロシティ集計値が算出済みであること

## 手順

> [!IMPORTANT] 各ステップの責任者 各ステップの見出しに **責任者** を明記する。
>
> - `[責任者: AI]`: AIが自律実行する（確認不要）
> - `[責任者: PO]`: POが実行する
> - `[責任者: 共同]`: AIが案を提示し、**POの確定を経てから**次のステップへ進む

### Step 1: 実績とセッション振り返りの確認 [責任者: AI]

対象スプリントの実績と各セッションの振り返りを収集し、**AIがスプリント全体の評価材料**として
整理して提示する。

- 完了した作業パッケージの実績（規模・労力）
- 各セッションの振り返り（協働品質指標・KPT）
- ベロシティ（完了数・合計規模）

収集方法は
[references/reference.md](/.agents/skills/bundles/management-bundle/record-sprint-metrics/references/reference.md)
の「実績確認フェーズ」を参照すること。

**整理フォーマット**: 数値ベースの事実（実績）と AI の評価コメントを**分離**して提示する。

```
【実績（事実）】
  • 完了した作業パッケージ数 / 合計規模 / 見積一致率: ...
  • 各セッションの振り返り指標値: ...
【AIの評価コメント】
  • 各指標の評価材料: ...
```

### Step 2: 評価の合意 [責任者: 共同]

Step 1 で整理した評価材料を PO に提示し、5指標のスコア（1〜5）とベロシティ値を PO と対話で確定する。
**POの確定を経るまで Step 3 へ進んではならない。**

### Step 3: 記録内容の確認 [責任者: 共同]

以下のコマンドで、記録される内容と変更理由を確認する。PO の承認後に次へ進む。 入力JSONの組み立て方は
[references/reference.md](/.agents/skills/bundles/management-bundle/record-sprint-metrics/references/reference.md)
を参照すること。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-sprint-metrics/scripts/record_sprint_metrics.ts --dry-run
```

### Step 4: スプリント評価の記録 [責任者: AI]

PO の承認後、実実行で評価を記録する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-sprint-metrics/scripts/record_sprint_metrics.ts
```

### Step 5: 結果報告 [責任者: AI]

記録完了を PO に報告する。

## 詳細リファレンス

- 入力JSON形式・対象の特定方法・dry-run 出力の解釈・実行パターンは
  [references/reference.md](/.agents/skills/bundles/management-bundle/record-sprint-metrics/references/reference.md)
  を参照

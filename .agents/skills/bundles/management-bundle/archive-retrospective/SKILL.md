---
name: archive-retrospective
description: スプリント終了時に、KPTと評価の記録完了を確認して振り返りを終了する。
tags:
  - trigger: archive-retrospective
  - trigger: close-retrospective
  - trigger: sprint-end
  - category: management
---

# archive-retrospective

スプリント終了時に、対象スプリントの振り返りに KPT とスプリント評価が記録済みであることを確認し、
振り返りを終了（アーカイブ）します。

## 前提条件

- 対象スプリントの振り返りが作成済みであること（`plan-retrospective` 実施済み）
- `record-sprint-kpt` で KPT が記録済みであること
- `record-sprint-metrics` でスプリント評価が記録済みであること

> [!WARNING] KPT と評価の両方が未設定のまま振り返りを終了しようとするとエラーになる。
> 必ず両方の記録完了を確認してから実行すること。

## 手順

> [!IMPORTANT] 各ステップの責任者 各ステップの見出しに **責任者** を明記する。
>
> - `[責任者: AI]`: AIが自律実行する（確認不要）
> - `[責任者: PO]`: POが実行する
> - `[責任者: 共同]`: AIが案を提示し、**POの確定を経てから**次のステップへ進む

### Step 1: 記録完了の事前確認 [責任者: 共同]

対象の振り返りを参照し、KPT とスプリント評価が記録済みであることを PO と確認する。

### Step 2: 終了内容の確認 [責任者: 共同]

以下のコマンドで、終了（アーカイブ）する対象を確認する。PO の承認後に次へ進む。
入力JSONの組み立て方は
[references/reference.md](/.agents/skills/bundles/management-bundle/archive-retrospective/references/reference.md)
を参照すること。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/archive-retrospective/scripts/archive_retrospective.ts --dry-run
```

### Step 3: 振り返りの終了 [責任者: AI]

PO の承認後、実実行で振り返りを終了（アーカイブ）する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/archive-retrospective/scripts/archive_retrospective.ts
```

### Step 4: 結果報告 [責任者: AI]

終了完了を PO に報告する。

## 詳細リファレンス

- 入力JSON形式・対象の特定方法・dry-run 出力の解釈・実行パターンは
  [references/reference.md](/.agents/skills/bundles/management-bundle/archive-retrospective/references/reference.md)
  を参照

---
name: record-sprint-kpt
description: スプリント終了時に、スプリント内の実績を確認してスプリントのKPTを記録する。
tags:
  - trigger: record-sprint-kpt
  - trigger: record-kpt
  - trigger: sprint-kpt
  - trigger: sprint-end
  - category: management
---

# record-sprint-kpt

スプリント終了時に、スプリント内の実績（完了した作業の規模・各セッションの振り返り）を確認し、
それを材料としてスプリントの KPT（Keep / Problem / Try / Advise）を記録します。

**実績確認なしに記録することを禁止する。** 記録の前に必ず「Step 1:
実績確認と材料の整理」を実施する。

## 前提条件

- 対象スプリントの振り返りが作成済みであること（`plan-retrospective` 実施済み）
- 対象スプリント内の各作業パッケージのセッション振り返り・メトリクスが記録済みであること

## 手順

> [!IMPORTANT] 各ステップの責任者 各ステップの見出しに **責任者** を明記する。
>
> - `[責任者: AI]`: AIが自律実行する（確認不要）
> - `[責任者: PO]`: POが実行する
> - `[責任者: 共同]`: AIが案を提示し、**POの確定を経てから**次のステップへ進む

### Step 1: 実績確認とふりかえり材料の整理 [責任者: AI]

対象スプリント内の以下のデータを収集し、**AIがふりかえりの材料**として整理して提示する。

- 完了した作業パッケージの実績（規模・労力）
- 各セッションの振り返り（協働品質指標・KPT）

収集方法は
[references/reference.md](/.agents/skills/bundles/management-bundle/record-sprint-kpt/references/reference.md)
の「実績確認フェーズ」を参照すること。

**整理フォーマット**: 数値ベースの事実（実績）と AI の観察コメントを**分離**して提示する。

```
【実績（事実）】
  • 完了した作業パッケージ数 / 合計規模: ...
  • 各セッションの振り返り指標値: ...
【AIの観察コメント】
  • 傾向・気づき: ...
```

### Step 2: KPT内容の合意 [責任者: 共同]

Step 1 で整理した材料に基づき、KPT（Keep / Problem / Try / Advise）の草案をPOに提示し、
**POとの対話で内容を確定する。** POの確定を経るまで Step 3 へ進んではならない。

### Step 3: 記録内容の確認 [責任者: 共同]

以下のコマンドで、記録される内容と変更理由を確認する。PO の承認後に次へ進む。 入力JSONの組み立て方は
[references/reference.md](/.agents/skills/bundles/management-bundle/record-sprint-kpt/references/reference.md)
を参照すること。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-sprint-kpt/scripts/record_sprint_kpt.ts --dry-run
```

### Step 4: スプリントKPTの記録 [責任者: AI]

PO の承認後、実実行で KPT を記録する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-sprint-kpt/scripts/record_sprint_kpt.ts
```

### Step 5: 結果報告 [責任者: AI]

記録完了を PO に報告する。

## 詳細リファレンス

- 入力JSON形式・対象の特定方法・dry-run 出力の解釈・実行パターンは
  [references/reference.md](/.agents/skills/bundles/management-bundle/record-sprint-kpt/references/reference.md)
  を参照

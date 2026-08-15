# record-sprint-metrics リファレンス

## 業務概要

スプリント終了時に、対象スプリントの振り返りへスプリントの評価（5指標）を記録します。
数値サマリ（5指標のスコアとベロシティ値）と、各指標のナラティブ（説明文）を分離して保存し、
あわせて変更理由が履歴として残されます。

**実績確認**: 記録の前に SKILL.md の Step 1（実績とセッション振り返りの確認）を必ず実施する。

## 実績確認フェーズ（SKILL.md Step 1 の収集手段）

対象スプリントのデータを `read-project-state` で収集する。入力JSONの組み立て方は
`read-project-state` のリファレンスを参照すること。

| 収集データ                                | 収集手段（read-project-state 入力例）                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| 完了した作業の実績（規模・労力）          | `{"entityType":"ProductBacklogItem","operation":"find","params":{"itemId":"<番号>"}}` |
| 各作業パッケージのセッション振り返り・KPT | `{"entityType":"WorkPackage","operation":"find","params":{"itemId":"<番号>"}}`        |
| ベロシティ（完了数・合計規模）            | スプリントの Velocity 集計 / `record-sprint-velocity` の結果                          |

## record_sprint_metrics.ts — スプリント評価記録

### 入力パラメータ

| パラメータ                                     | 型       | 必須 | 説明                                                          |
| ---------------------------------------------- | -------- | ---- | ------------------------------------------------------------- |
| `sprintNumber`                                 | `number` | △    | 対象スプリント番号。`code` 未指定時に検索で特定するために使用 |
| `code`                                         | `string` | △    | 対象の振り返り番号。`sprintNumber` の代わりに直接指定         |
| `title`                                        | `string` | 任意 | 対象の振り返りタイトル。`code` 指定時に省略可（自動補完）     |
| `scope`                                        | `object` | 任意 | 対象リポジトリのスコープ。省略時は実行時解決                  |
| `metrics.summary.goalAchievementScore`         | `number` | 必須 | 目標達成度スコア（1〜5の整数）                                |
| `metrics.summary.estimationAccuracyScore`      | `number` | 必須 | 見積精度スコア（1〜5の整数）                                  |
| `metrics.summary.qualityIntegrityScore`        | `number` | 必須 | 品質維持スコア（1〜5の整数）                                  |
| `metrics.summary.collaborationDisciplineScore` | `number` | 必須 | 協働規律スコア（1〜5の整数）                                  |
| `metrics.summary.velocity`                     | `number` | 必須 | ベロシティ値（非負の数値）                                    |
| `metrics.goalAchievement`                      | `string` | 必須 | 目標達成度の説明                                              |
| `metrics.estimationAccuracy`                   | `string` | 必須 | 見積精度の説明                                                |
| `metrics.qualityIntegrity`                     | `string` | 必須 | 品質維持の説明                                                |
| `metrics.collaborationDiscipline`              | `string` | 必須 | 協働規律の説明                                                |
| `metrics.velocity`                             | `string` | 必須 | ベロシティの説明                                              |
| `reason.description`                           | `string` | 必須 | 変更理由（履歴コメント）                                      |

> `code` と `sprintNumber` の少なくとも一方が必須。`code` 優先。空の `code` は拒否される。

### バリデーション規則

- スコアは **1〜5 の整数**。範囲外（0や6、小数）は `INVALID_INPUT` エラー
- `velocity` は非負の有限数値
- 説明文（ナラティブ）5項目は空文字不可

### 1024バイト制限

説明文5項目（`metrics.goalAchievement` 等）は、**UTF-8 バイト長**が **1024 バイト以下**であること。
超過した場合は `INVALID_INPUT` エラーとなる。

- 例: 日本語1文字 ≈ 3バイトのため、日本語のみの場合は約341文字が上限の目安

### 対象の特定

1. **`code` 指定**: 指定された振り返り番号をそのまま対象とする（検索不要）。
2. **`sprintNumber` 指定**: 振り返りを検索し、タイトルが「Sprint N Retrospective」形式（N =
   スプリント番号）に**完全一致**するものを特定する。前方一致（"Sprint 2" が "Sprint 20"
   に誤マッチ） はしない。0件・複数件の場合はエラー。

### dry-run 出力の解釈

`resolvedTarget` が解決された対象を、`steps` に含まれる記録ステップの `params` が記録内容と
変更理由を示す。`code` 未指定の dry-run では `resolvedTarget` に `{"note":"実行時に検索します"}`
が入る（dry-run は検索を実行しない）。

```json
{
  "summary": "Record Sprint Metrics: Sprint 20 Retrospective",
  "resolvedTarget": { "code": "670", "title": "Sprint 20 Retrospective" },
  "steps": [
    { "entity": "Scope", "operation": "resolve" },
    {
      "entity": "Retrospective",
      "operation": "recordSprintMetrics",
      "params": {
        "itemId": "670",
        "metrics": {
          "summary": {
            "goalAchievementScore": 5,
            "estimationAccuracyScore": 4,
            "qualityIntegrityScore": 4,
            "collaborationDisciplineScore": 5,
            "velocity": 21
          }
        }
      }
    },
    {
      "entity": "Retrospective",
      "operation": "recordSprintMetrics",
      "params": { "itemId": "670", "body": "## Record Sprint Metrics\n\n<変更理由>" }
    }
  ]
}
```

チャットウィンドウでは、`summary` を見出しとして先頭に表示し、`steps` を以下の形式で展開する：

```
📋 Plan: <summary>
  • 対象: <title> (#<code>)
  • 記録: 5指標（目標達成度 / 見積精度 / 品質維持 / 協働規律 / ベロシティ）
  • 変更履歴: <reason.description>
```

### 実行例

```bash
# dry-run（記録内容の確認のみ・何も変更しない）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-sprint-metrics/scripts/record_sprint_metrics.ts --dry-run

# 実実行
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-sprint-metrics/scripts/record_sprint_metrics.ts
```

## アーキテクチャ上の責務

- スクリプトは「入力の検証・対象の特定・UseCase呼び出し・結果表示」を担当する
- 実績確認・採点対話は SKILL.md の手順・AI側に保持する（Step 1〜2）
- 外部操作は既存 UseCase のみを経由する

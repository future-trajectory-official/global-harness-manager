# record-sprint-velocity リファレンス

## 業務概要

スプリント終了時に、対象スプリントのベロシティ集計値をGitHub Milestone description の `## Velocity`
セクションに記録する。

## record_sprint_velocity.ts — スプリントベロシティ記録

### 対象スプリントの解決（引数なし find）

本スクリプトは入力から identifier（sprintNumber / Milestone番号）を受け取らない。
`find()`（引数なし）により**最新のオープンスプリント（Milestone）を自動解決**し、
そのスプリント番号と Milestone 番号で `recordVelocity` を実行する。

- スプリントのスプリント指定なし運用は、スプリント終了処理（Phase 9 conclude 前）が
  常にオープン中の最新スプリントを対象とすることに基づく。
- dry-run 出力の `resolvedSprint`（`sprintNumber` / `milestoneNumber`）で解決結果を確認できる。

### 入力パラメータ

| パラメータ             | 型       | 必須 | 説明                               |
| ---------------------- | -------- | ---- | ---------------------------------- |
| `velocity.pbiCount`    | `number` | 必須 | 完了PBI数（非負）                  |
| `velocity.totalWeight` | `number` | 必須 | size_actual のウェイト合計（非負） |
| `velocity.matchRate`   | `number` | 必須 | 見積一致率（0.0〜1.0）             |
| `velocity.summary`     | `string` | 必須 | 数値で説明しきれない文脈・留意点   |

### 集計パラメータの作り方

各パラメータは、対象スプリントに含まれる**完了PBIの `size_actual`** を収集して以下のように算出する。

| パラメータ    | 算出方法                                                        |
| ------------- | --------------------------------------------------------------- |
| `pbiCount`    | 完了PBI数                                                       |
| `totalWeight` | 各PBIの `size_actual` を WEIGHT_MAP（下表）でウェイト化した合計 |
| `matchRate`   | 見積サイズ（estimate）と `size_actual` が一致したPBI数 ÷ 全体   |
| `summary`     | 数値で説明しきれない文脈・留意点（乖離要因等）                  |

### 出力

`ExecutionResult` をJSONで出力する。`recordVelocity` の成功により Milestone description の
`## Velocity` セクションが更新される。

### 実行例

```bash
# dry-run（最新オープンスプリントを解決して Plan を表示）
echo '{"velocity":{"pbiCount":5,"totalWeight":21,"matchRate":0.8,"summary":"全WPを計画内に完了"}}' | deno run -A .agents/skills/bundles/management-bundle/record-sprint-velocity/scripts/record_sprint_velocity.ts --dry-run

# 実実行
echo '{"velocity":{"pbiCount":5,"totalWeight":21,"matchRate":0.8,"summary":"全WPを計画内に完了"}}' | deno run -A .agents/skills/bundles/management-bundle/record-sprint-velocity/scripts/record_sprint_velocity.ts
```

## WEIGHT_MAP（本スキル内で独立定義）

旧スキル record-velocity からの import は禁止。本スキル内で独立に定義する。

| サイズ | ウェイト |
| ------ | -------- |
| XS     | 1        |
| S      | 2        |
| M      | 3        |
| L      | 5        |
| XL     | 8        |

## アーキテクチャ上の責務

- スクリプトは「stdin パース・UseCase呼び出し・結果表示」の3役割のみを担当する
- ベロシティの集計・対話は SKILL.md の手順・AI側に保持する
- GitHub 操作は既存 UseCase（`recordVelocity`）のみを経由する
- 旧スキル（record-velocity / archive-backlog）とは一切連携しない

# record-sprint-velocity リファレンス

## 業務概要

スプリント終了時に、対象スプリントのベロシティ集計値をGitHub Milestone description の `## Velocity`
セクションに記録する。

## record_sprint_velocity.ts — スプリントベロシティ記録

対象スプリントは引数なし `find()`
により**最新のオープンスプリント（Milestone）を自動解決**する。入力に identifier / sprintNumber
は不要。

### 入力パラメータ

| パラメータ             | 型       | 必須 | 説明                               |
| ---------------------- | -------- | ---- | ---------------------------------- |
| `velocity.pbiCount`    | `number` | 必須 | 完了PBI数（非負）                  |
| `velocity.totalWeight` | `number` | 必須 | size_actual のウェイト合計（非負） |
| `velocity.matchRate`   | `number` | 必須 | 見積一致率（0.0〜1.0）             |
| `velocity.summary`     | `string` | 必須 | 数値で説明しきれない文脈・留意点   |

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

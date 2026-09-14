# record-pbi-effort-analysis リファレンス

## 業務概要

スプリント終了時に、対象PBI配下の全WPのeffort集計と乖離分析をGitHubカスタムフィールドに記録する。

## record_pbi_effort_analysis.ts — PBI effort集計・乖離分析の記録

### 入力パラメータ

| パラメータ               | 型                                         | 必須  | 説明                                           |
| ------------------------ | ------------------------------------------ | ----- | ---------------------------------------------- |
| `identifier`             | `{title,id,code}`                          | 必須  | PBIの識別子（code=Issue番号）                  |
| `planningReview`         | `string`                                   | 任意  | 計画乖離レビュー（実実行で指定）               |
| `executionReview`        | `string`                                   | 任意  | 実行乖離レビュー（実実行で指定）               |
| `improvementSuggestions` | `string`                                   | 任意  | 改善提案（実実行で指定）                       |
| `effortSummary`          | `{initialEstimate,plannedEstimate,actual}` | 必須* | PBI配下のWP effort集計値。乖離分析記録時に必須 |

- `planningReview` / `executionReview` を**省略**した場合: `analyzeEffort`（集計）のみ実行する
- `planningReview` / `executionReview` を**指定**した場合: `analyzeEffort`（集計）→
  `recordAnalysis`（記録）を実行する
- **※乖離分析を記録する場合、`effortSummary` は必須**。`analyzeEffort` の実行結果
  `output.wp_effort_summary` を入力に引き継ぐ（`wp_effort_summary` が `harness-effort-summary`
  に記録されることを保証するため）
- **キー名変換**: `analyzeEffort` の出力は snake_case （`initial_estimate` / `planned_estimate` /
  `actual`）だが、`effortSummary` の入力キーは **camelCase**（`initialEstimate` / `plannedEstimate`
  / `actual`）へ変換して引き継ぐこと。 各値は **0以上の有限数**
  で全フィールド必須（部分指定・空オブジェクトはエラー）。

### 出力

`ExecutionResult` をJSONで出力する。`analyzeEffort` の実行結果に
`output.wp_effort_summary`（`initial_estimate` / `planned_estimate` / `actual` の合計）が含まれる。

### 実行例

```bash
# 集計のみ（dry-run。id に node-id、code に Issue番号を指定）
echo '{"identifier":{"title":"Sprint-End-Persistence","id":"I_kwDOR5-zI88AAAABKcLZJA","code":"614"}}' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-effort-analysis/scripts/record_pbi_effort_analysis.ts --dry-run

# 集計のみ（実実行）
echo '{"identifier":{"title":"Sprint-End-Persistence","id":"I_kwDOR5-zI88AAAABKcLZJA","code":"614"}}' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-effort-analysis/scripts/record_pbi_effort_analysis.ts

# 集計 + 乖離分析の記録（effortSummary 必須）
echo '{"identifier":{"title":"Sprint-End-Persistence","id":"I_kwDOR5-zI88AAAABKcLZJA","code":"614"},"planningReview":"初期見積を上回る計画変更があった","executionReview":"実績は計画内に収まった","improvementSuggestions":"初期見積精度の改善を試みる","effortSummary":{"initialEstimate":3,"plannedEstimate":4,"actual":5}}' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-effort-analysis/scripts/record_pbi_effort_analysis.ts
```

### 記録されるカスタムフィールド

| 入力フィールド           | GitHub カスタムフィールド名         |
| ------------------------ | ----------------------------------- |
| `effortSummary`          | `harness-effort-summary`            |
| `planningReview`         | `harness-variance-review-planning`  |
| `executionReview`        | `harness-variance-review-execution` |
| `improvementSuggestions` | `harness-improvement-suggestions`   |

## アーキテクチャ上の責務

- スクリプトは「stdin パース・UseCase呼び出し・結果表示」の3役割のみを担当する
- 集計・乖離分析・対話は SKILL.md の手順・AI側に保持する
- GitHub 操作は既存 UseCase（`analyzeEffort` / `recordAnalysis`）のみを経由する

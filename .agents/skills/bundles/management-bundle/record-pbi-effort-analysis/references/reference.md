# record-pbi-effort-analysis リファレンス

## 業務概要

スプリント終了時に、対象PBI配下の全WPのeffort集計と乖離分析をGitHubカスタムフィールドに記録する。

## record_pbi_effort_analysis.ts — PBI effort集計・乖離分析の記録

### 入力パラメータ

| パラメータ               | 型                | 必須 | 説明                             |
| ------------------------ | ----------------- | ---- | -------------------------------- |
| `identifier`             | `{title,id,code}` | 必須 | PBIの識別子（code=Issue番号）    |
| `planningReview`         | `string`          | 任意 | 計画乖離レビュー（実実行で指定） |
| `executionReview`        | `string`          | 任意 | 実行乖離レビュー（実実行で指定） |
| `improvementSuggestions` | `string`          | 任意 | 改善提案（実実行で指定）         |

- `planningReview` / `executionReview` を**省略**した場合: `analyzeEffort`（集計）のみ実行する
- `planningReview` / `executionReview` を**指定**した場合: `analyzeEffort`（集計）→
  `recordAnalysis`（記録）を実行する

### 出力

`ExecutionResult` をJSONで出力する。`analyzeEffort` の実行結果に
`output.wp_effort_summary`（`initial_estimate` / `planned_estimate` / `actual` の合計）が含まれる。

### 実行例

```bash
# 集計のみ（dry-run）
echo '{"identifier":{"title":"Sprint-End-Persistence","id":"node-id","code":"614"}}' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-effort-analysis/scripts/record_pbi_effort_analysis.ts --dry-run

# 集計のみ（実実行）
echo '{"identifier":{"title":"Sprint-End-Persistence","id":"node-id","code":"614"}}' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-effort-analysis/scripts/record_pbi_effort_analysis.ts

# 集計 + 乖離分析の記録
echo '{"identifier":{"title":"Sprint-End-Persistence","id":"node-id","code":"614"},"planningReview":"初期見積を上回る計画変更があった","executionReview":"実績は計画内に収まった","improvementSuggestions":"初期見積精度の改善を試みる"}' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-effort-analysis/scripts/record_pbi_effort_analysis.ts
```

### 記録されるカスタムフィールド

| 入力フィールド           | GitHub カスタムフィールド名         |
| ------------------------ | ----------------------------------- |
| `planningReview`         | `harness-variance-review-planning`  |
| `executionReview`        | `harness-variance-review-execution` |
| `improvementSuggestions` | `harness-improvement-suggestions`   |

## アーキテクチャ上の責務

- スクリプトは「stdin パース・UseCase呼び出し・結果表示」の3役割のみを担当する
- 集計・乖離分析・対話は SKILL.md の手順・AI側に保持する
- GitHub 操作は既存 UseCase（`analyzeEffort` / `recordAnalysis`）のみを経由する
- 旧スキル（record-velocity / archive-backlog）とは一切連携しない

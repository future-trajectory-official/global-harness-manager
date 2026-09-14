# record-work-package-metrics リファレンス

## 業務概要

セッション完了時に4つの協働品質指標をバックログWPに記録する。

## record_metrics.ts — メトリクス記録

POと合意したメトリクススコア（数値サマリ）と各指標のナラティブをWPに記録する。 数値は
`harness-metrics-summary`、ナラティブは4指標独立フィールドに保存される。

### 入力パラメータ

| パラメータ                 | 型                | 必須 | 説明                                          |
| -------------------------- | ----------------- | ---- | --------------------------------------------- |
| `identifier`               | `{title,id,code}` | 必須 | WPの識別子                                    |
| `intentAlignmentScore`     | `number`          | 必須 | 意図整合スコア（1-5の整数）                   |
| `constraintAdherenceScore` | `number`          | 必須 | 制約遵守スコア（1-5の整数）                   |
| `contextExtractionScore`   | `number`          | 必須 | コンテキスト抽出スコア（1-5の整数）           |
| `workSizeStabilityScore`   | `number`          | 必須 | 作業規模安定性スコア（1-5の整数）             |
| `intentAlignment`          | `string`          | 任意 | Intent Alignment のナラティブ（定性説明）     |
| `constraintAdherence`      | `string`          | 任意 | Constraint Adherence のナラティブ（定性説明） |
| `contextExtraction`        | `string`          | 任意 | Context Extraction のナラティブ（定性説明）   |
| `workSizeStability`        | `string`          | 任意 | Work Size Stability のナラティブ（定性説明）  |

> ナラティブは省略時に空文字として記録される。metrics-guide（セッションメトリクス）に従い、
> 各指標の定性説明は独立フィールドに記録することが推奨される。

### 実行例

```bash
# id に node-id、code に Issue番号を指定
echo '{
  "identifier": {"title":"Session-Lifecycle-Persistence","id":"I_kwDOR5-zI88AAAABKcLX9A","code":"612"},
  "intentAlignmentScore": 5,
  "constraintAdherenceScore": 4,
  "contextExtractionScore": 3,
  "workSizeStabilityScore": 5,
  "intentAlignment": "計画段階の対話が充実しており意図齟齬はゼロ。",
  "constraintAdherence": "ルール遵守は徹底されていた。",
  "contextExtraction": "既存コードの事前読解精度を高める余地あり。",
  "workSizeStability": "作業規模は安定していた。"
}' | deno run -A .agents/skills/bundles/management-bundle/record-work-package-metrics/scripts/record_metrics.ts
```

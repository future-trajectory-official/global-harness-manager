# record-work-package-metrics リファレンス

## 業務概要

セッション完了時に4つの協働品質指標をバックログWPに記録する。

## record_metrics.ts — メトリクス記録

POと合意したメトリクススコアをWPに記録する。

### 入力パラメータ

| パラメータ                 | 型                | 必須 | 説明                              |
| -------------------------- | ----------------- | ---- | --------------------------------- |
| `identifier`               | `{title,id,code}` | 必須 | WPの識別子                        |
| `intentAlignmentRate`      | `number`          | 必須 | 意図の整合率（1-5の整数）         |
| `constraintAdherenceScore` | `number`          | 必須 | 制約遵守スコア（1-5の整数）       |
| `contextExtractionQuality` | `number`          | 必須 | コンテキスト説明の質（1-5の整数） |
| `workSizeStability`        | `number`          | 必須 | 作業単位の安定性（1-5の整数）     |
| `comment`                  | `string`          | 任意 | 総合所見                          |

### 実行例

```bash
echo '{
  "identifier": {"title":"Session-Lifecycle-Persistence","id":"42","code":"42"},
  "intentAlignmentRate": 5,
  "constraintAdherenceScore": 4,
  "contextExtractionQuality": 3,
  "workSizeStability": 5,
  "comment": "計画段階の対話が充実しており意図齟齬はゼロ。既存コードの事前読解精度を高める余地あり"
}' | deno run -A .agents/skills/bundles/management-bundle/record-work-package-metrics/scripts/record_metrics.ts
```

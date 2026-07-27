# record-work-package-effort リファレンス

## 業務概要

セッション完了時に、介入の整理・成果の記録・プロセス分析を実行する。

## record_effort_and_analysis.ts — 実績 + 分析の一括記録

POとの対話で確定した介入実績とプロセス分析を一括で記録する。

### 入力パラメータ

| パラメータ               | 型                | 必須 | 説明                         |
| ------------------------ | ----------------- | ---- | ---------------------------- |
| `identifier`             | `{title,id,code}` | 必須 | WPの識別子                   |
| `actual`                 | `number`          | 必須 | 実績介入回数（0以上の整数）  |
| `planningReview`         | `string`          | 必須 | 計画の進め方に関する振り返り |
| `executionReview`        | `string`          | 必須 | 実行の進め方に関する振り返り |
| `improvementSuggestions` | `string`          | 任意 | 次回に向けた改善提案         |

### 出力

本スクリプトは `ExecutionResult` をJSONで出力する。

### 実行例

```bash
# 通常実行（実績記録＋分析記録を一括）
echo '{
  "identifier": {"title":"Session-Lifecycle-Persistence","id":"42","code":"42"},
  "actual": 3,
  "planningReview": "計画は適切だったが、ACの詳細度が不足していた",
  "executionReview": "実装はスムーズに進んだ。テスト駆動で品質が安定した",
  "improvementSuggestions": "計画時に類似WPのACを事前参照する"
}' | deno run -A .agents/skills/bundles/management-bundle/record-work-package-effort/scripts/record_effort_and_analysis.ts

# dry-run（処理内容の確認のみ）
echo '{"identifier":{"title":"Test","id":"1","code":"1"},"actual":0,"planningReview":"OK","executionReview":"OK"}' | deno run -A --dry-run .agents/skills/bundles/management-bundle/record-work-package-effort/scripts/record_effort_and_analysis.ts
```

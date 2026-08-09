# record-pbi-size-analysis リファレンス

## 業務概要

スプリント終了時に、対象PBIの実感サイズ（size_actual）とサイズ乖離理由（variance_reason）を
GitHubカスタムフィールドに記録する。

## record_pbi_size_analysis.ts — PBIサイズ確定

### 入力パラメータ

| パラメータ       | 型                | 必須 | 説明                              |
| ---------------- | ----------------- | ---- | --------------------------------- |
| `identifier`     | `{title,id,code}` | 必須 | PBIの識別子（code=Issue番号）     |
| `sizeActual`     | `string`          | 必須 | 確定した実感サイズ（XS/S/M/L/XL） |
| `varianceReason` | `string`          | 任意 | 見積との乖離理由                  |

### 出力

`ExecutionResult` をJSONで出力する。`confirmSize` の成功により `harness-size-actual` と
`harness-variance-review-size` が更新される。

### 実行例

```bash
# dry-run
echo '{"identifier":{"title":"Sprint-End-Persistence","id":"node-id","code":"614"},"sizeActual":"M","varianceReason":"実装範囲が拡大した"}' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-size-analysis/scripts/record_pbi_size_analysis.ts --dry-run

# 実実行
echo '{"identifier":{"title":"Sprint-End-Persistence","id":"node-id","code":"614"},"sizeActual":"M","varianceReason":"実装範囲が拡大した"}' | deno run -A .agents/skills/bundles/management-bundle/record-pbi-size-analysis/scripts/record_pbi_size_analysis.ts
```

### 記録されるカスタムフィールド

| 入力フィールド   | GitHub カスタムフィールド名    |
| ---------------- | ------------------------------ |
| `sizeActual`     | `harness-size-actual`          |
| `varianceReason` | `harness-variance-review-size` |

## アーキテクチャ上の責務

- スクリプトは「stdin パース・UseCase呼び出し・結果表示」の3役割のみを担当する
- 実績サイズの提案・乖離理由の整理・対話は SKILL.md の手順・AI側に保持する
- GitHub 操作は既存 UseCase（`confirmSize`）のみを経由する

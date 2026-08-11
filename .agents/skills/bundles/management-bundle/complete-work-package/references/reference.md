# complete-work-package リファレンス

## 業務概要

WPを完了状態（done）に遷移し、必要に応じて親PBIも完了する。

## complete_wp.ts — WP完了

WPを完了状態に遷移する。

### 入力パラメータ

| パラメータ   | 型                | 必須 | 説明       |
| ------------ | ----------------- | ---- | ---------- |
| `identifier` | `{title,id,code}` | 必須 | WPの識別子 |

### 出力

本スクリプトは `ExecutionResult` をJSONで出力する。stepResultsからWPの完了状態を確認できる。

### 実行例

```bash
# id に node-id、code に Issue番号を指定
echo '{"identifier":{"title":"Session-Lifecycle-Persistence","id":"I_kwDOR5-zI88AAAABKcLX9A","code":"612"}}' | deno run -A .agents/skills/bundles/management-bundle/complete-work-package/scripts/complete_wp.ts
```

## complete_pbi.ts — PBI完了

親PBI配下の全WPが完了した場合に、親PBIを完了状態に遷移する。

### 入力パラメータ

| パラメータ   | 型                | 必須 | 説明        |
| ------------ | ----------------- | ---- | ----------- |
| `identifier` | `{title,id,code}` | 必須 | PBIの識別子 |

### 実行例

```bash
# id に node-id、code に Issue番号を指定
echo '{"identifier":{"title":"EntityLifecycle","id":"I_kwDOR5-zI88AAAABMOdNyg","code":"655"}}' | deno run -A .agents/skills/bundles/management-bundle/complete-work-package/scripts/complete_pbi.ts
```

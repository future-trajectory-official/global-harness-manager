# start-work-package リファレンス

## 業務概要

計画承認後のWPに対して、計画後effort見積りの記録とステータス着手（InProgress）遷移を行う。

## estimate_planned_effort.ts — 計画後effort見積り

WPの計画後effort見積り（plannedEstimate）を記録する。

### 入力パラメータ

| パラメータ        | 型                | 必須 | 説明                                   |
| ----------------- | ----------------- | ---- | -------------------------------------- |
| `identifier`      | `{title,id,code}` | 必須 | WPの識別子                             |
| `plannedEstimate` | `number`          | 必須 | AIが算出した計画後見積り値（介入回数） |

### 実行例

```bash
echo '{"identifier":{"title":"Session-Lifecycle-Persistence","id":"42","code":"42"},"plannedEstimate":3}' | deno run -A .agents/skills/bundles/management-bundle/start-work-package/scripts/estimate_planned_effort.ts
```

## start_wp.ts — WP着手

WPのステータスをInProgressに遷移する。

### 入力パラメータ

| パラメータ   | 型                | 必須 | 説明       |
| ------------ | ----------------- | ---- | ---------- |
| `identifier` | `{title,id,code}` | 必須 | WPの識別子 |

### 実行例

```bash
echo '{"identifier":{"title":"Session-Lifecycle-Persistence","id":"42","code":"42"}}' | deno run -A .agents/skills/bundles/management-bundle/start-work-package/scripts/start_wp.ts
```

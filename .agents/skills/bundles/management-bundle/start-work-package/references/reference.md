# start-work-package リファレンス

## 業務概要

計画承認後のWPに対して、計画後effort見積りの記録とステータス着手（InProgress）遷移を行う。

## 計画前見積の確認（read-project-state 呼び出し）

対象WPの既存の計画前見積（initial_estimate）を、`read-project-state`
スキルのスクリプトを介して確認する。

### 入力JSON

`read-project-state` の入力スキーマに準拠する（詳細は
[input-schema.md](/.agents/skills/bundles/management-bundle/read-project-state/references/input-schema.md)
を参照）。

| キー       | 型     | 値                             |
| ---------- | ------ | ------------------------------ |
| entityType | string | `"WorkPackage"`                |
| operation  | string | `"find"`                       |
| params     | object | `{ "itemId": "<着手WP番号>" }` |

### 実行例

```bash
echo '{"entityType":"WorkPackage","operation":"find","params":{"itemId":"643"}}' | deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
```

### 出力の解釈

- 出力の `output.projectItems[].effort` に、当該WPの `harness-effort-summary`（JSON文字列）が入る。
- `effort` をパースし、`initial_estimate` を**計画前見積（介入回数）**として採用する。
- `effort` が空（`null`）の場合は計画前見積が未設定のため、その旨をPOに確認する。
- 計画前見積・計画後見積・完了時実績の定義と算出方法は
  [guides/backlog-guidelines.md](/guides/backlog-guidelines.md) の **2.2.1** に従う。

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

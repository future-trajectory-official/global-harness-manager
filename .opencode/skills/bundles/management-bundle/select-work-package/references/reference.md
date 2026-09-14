# select-work-package リファレンス

## 業務概要

スプリントバックログから、指定された条件に合致するWork Packageを検索する。
POが次に着手するWPを選択するための情報を提供する。

## search_wp.ts — WP検索

条件に合致するWPをスプリントバックログから検索する。

### 入力パラメータ

| パラメータ     | 型     | 必須 | 説明                                                                                         |
| -------------- | ------ | ---- | -------------------------------------------------------------------------------------------- |
| `status`       | string | 任意 | 検索するWPのステータス。**下記「statusの指定可能値」から選択すること**。デフォルト: `"Todo"` |
| `sprintNumber` | number | 任意 | 特定スプリント内のみに絞り込む場合に指定                                                     |

#### statusの指定可能値

`status`
は**この一覧から正確に選択**すること。値は**大文字小文字・空白を含めて完全一致**で照合されるため、
この一覧以外の値（例: `todo`、`in_progress`、`InProgress`）を指定すると0件になる。

| 値            | 意味                               |
| ------------- | ---------------------------------- |
| `Todo`        | 未着手                             |
| `In Progress` | 着手済み                           |
| `Done`        | 完了                               |
| `__none__`    | ステータス未設定（Null）のWPを検索 |

### 出力

本スクリプトは `ExecutionResult` をJSONで出力する。 AIは `stepResults`
から該当するWP一覧を取得し、整形してPOに提示する。

出力例:

```json
{
  "stepResults": [
    {
      "operation": "resolve",
      "success": true,
      "output": { "owner": "future-trajectory-official", "repository": "global-harness-manager" }
    },
    {
      "operation": "search",
      "success": true,
      "output": [
        {
          "title": "Session-Lifecycle-Persistence",
          "id": "123",
          "code": "123",
          "status": "Todo",
          "parentPbi": { "title": "EntityLifecycle", "id": "100", "code": "100" },
          "initialEstimate": 3,
          "plannedEstimate": null,
          "acCount": 9
        }
      ]
    }
  ]
}
```

### 実行例

```bash
# デフォルト（status未指定 → "Todo"）
echo '{}' | deno run -A .agents/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts

# 特定ステータス（指定可能値から選択）
echo '{"status":"In Progress"}' | deno run -A .agents/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts

# 特定スプリント＋特定ステータス
echo '{"status":"Todo","sprintNumber":19}' | deno run -A .agents/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts

# ステータス未設定（Null）を検索
echo '{"status":"__none__"}' | deno run -A .agents/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts
```

# select-work-package リファレンス

## 業務概要

スプリントバックログから、指定された条件に合致するWork Packageを検索する。
POが次に着手するWPを選択するための情報を提供する。

## search_wp.ts — WP検索

条件に合致するWPをスプリントバックログから検索する。

### 入力パラメータ

| パラメータ     | 型     | 必須 | 説明                                       |
| -------------- | ------ | ---- | ------------------------------------------ |
| `status`       | string | 任意 | 検索するWPのステータス。デフォルト: `todo` |
| `sprintNumber` | number | 任意 | 特定スプリント内のみに絞り込む場合に指定   |

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
          "status": "todo",
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
# デフォルト（status=todo）
echo '{"status":"todo"}' | deno run -A .agents/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts

# 特定スプリント＋特定ステータス
echo '{"status":"in_progress","sprintNumber":19}' | deno run -A .agents/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts
```

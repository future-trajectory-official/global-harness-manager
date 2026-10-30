# select-work-package リファレンス

## 業務概要

スプリントバックログから、指定された条件に合致するWork Packageを検索する。
POが次に着手するWPを選択するための情報を提供する。

## search_wp.ts — WP検索

条件に合致するWPをスプリントバックログから検索する。

### 入力パラメータ

| パラメータ        | 型     | 必須 | 説明                                                                                                             |
| ----------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------------- |
| `status`          | string | 任意 | 検索するWPのステータス（ProjectV2 Status）。**下記「statusの指定可能値」から選択すること**。デフォルト: `"Todo"` |
| `sprintNumber`    | number | 任意 | 特定スプリント内のみに絞り込む場合に指定                                                                         |
| `parentPbiNumber` | number | 任意 | 親PBIのIssue番号。指定時は当該PBI配下のWPのみに絞り込む                                                          |

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

> `status` は **ProjectV2 の Status**（作業段階）であり、Issue の開閉状態とは別概念である。
> 開閉は出力の `issueState`（`OPEN` / `CLOSED`）で確認する。`status` が `Done` でも `issueState` が
> `OPEN` のWPは存在する（アーカイブ前の完了WP）。

#### parentPbiNumber の絞り込みに関する制約

`parentPbiNumber` は ProjectV2 のフィルタDSLで表現できないため、**取得後にローカルで絞り込む**。
取得は `pageInfo.hasNextPage` による全ページ連結のため件数上限はない（1ページ100件）。 ただし `body`
も同時取得するため、ボードの件数が多いほど応答は大きくなる。

`parentPbiNumber` は正の整数のみ受理し、それ以外は `INVALID_INPUT` で失敗する
（無言で0件を返すと「子WPが無い」と誤認するため）。

### 出力

本スクリプトは `ExecutionResult` をJSONで出力する。 AIは `stepResults`
から該当するWP一覧を取得し、整形してPOに提示する。

各要素は以下のキーを持つ（`output[].` は省略）。

| キー              | 型                                    | 説明                                                                        |
| ----------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `number`          | number                                | Issue番号（後方互換のため維持）                                             |
| `title`           | string                                | WPのタイトル                                                                |
| `id`              | string                                | Issue の node id（他スキルの `identifier.id` にそのまま渡せる）             |
| `code`            | string                                | Issue番号の文字列（他スキルの `identifier.code` にそのまま渡せる）          |
| `status`          | `"Todo"｜"In Progress"｜"Done"｜null` | ProjectV2 の Status。未設定は null                                          |
| `issueState`      | `"OPEN"｜"CLOSED"`                    | Issue の開閉状態（`status` とは別軸）                                       |
| `parentPbi`       | `{title,id,code}｜null`               | 親PBIの識別子。親が無い場合は null                                          |
| `initialEstimate` | `number｜null`                        | 計画前effort（Sprint Board `harness-effort-summary` の `initial_estimate`） |
| `plannedEstimate` | `number｜null`                        | 計画後effort（同 `planned_estimate`）。未着手WPでは null                    |
| `acCount`         | number                                | Issue本文中のAC行数（✅済みも含む。コードフェンス内は除外）                 |

> `acCount` は WP完了時に✅化できるAC行と**同一の判定**（同じ書式・同じ除外規則）で数える。
> 受理するAC書式は
> [complete-work-package/references/reference.md](/.opencode/skills/bundles/management-bundle/complete-work-package/references/reference.md)
> の「AC行の書式」を参照すること。

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
          "number": 877,
          "title": "WP1: WP検索の射影一致とAC完了記録の書込経路",
          "id": "I_kwDOR5-zI88AAAABbG5lUQ",
          "code": "877",
          "status": "In Progress",
          "issueState": "OPEN",
          "parentPbi": {
            "title": "[WP操作] AC完了の記録経路とWP検索・既定ブランチの是正",
            "id": "I_kwDOR5-zI88AAAABbGdTvw",
            "code": "876"
          },
          "initialEstimate": 3,
          "plannedEstimate": 4,
          "acCount": 4
        }
      ]
    }
  ]
}
```

> `id` / `code` はそのまま他スキルの `identifier` に渡せる。`parentPbi.code`
> が親PBIのIssue番号である。

### 実行例

```bash
# デフォルト（status未指定 → "Todo"）
echo '{}' | deno run -A .opencode/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts

# 特定ステータス（指定可能値から選択）
echo '{"status":"In Progress"}' | deno run -A .opencode/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts

# 特定スプリント＋特定ステータス
echo '{"status":"Todo","sprintNumber":19}' | deno run -A .opencode/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts

# ステータス未設定（Null）を検索
echo '{"status":"__none__"}' | deno run -A .opencode/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts

# 親PBI配下のWPのみを検索（親PBI #876 の子WP）
echo '{"status":"Todo","sprintNumber":31,"parentPbiNumber":876}' | deno run -A .opencode/skills/bundles/management-bundle/select-work-package/scripts/search_wp.ts
```

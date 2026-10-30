# complete-work-package リファレンス

## 業務概要

WPを完了状態（done）に遷移し、必要に応じて親PBIも完了する。

## complete_wp.ts — WP完了

WPを完了状態に遷移する。あわせて Issue 本文の ACチェックボックスを✅化する。

### 入力パラメータ

| パラメータ           | 型                | 必須 | 説明                                                         |
| -------------------- | ----------------- | ---- | ------------------------------------------------------------ |
| `identifier`         | `{title,id,code}` | 必須 | WPの識別子                                                   |
| `acceptanceCriteria` | `number[]`        | 任意 | ✅化するAC番号。省略時は本文中の全ACを✅化する。空配列は不可 |

### 処理順序

1. Issue
   本文中のACチェックボックス行のみを✅化する（付随エビデンス行・本文の他領域・改行コードは保持）
2. 1 が成功した場合に限り、Project Status を `Done` へ変更する
3. 2 も失敗した場合は `STATUS_UPDATE_FAILED`
   で失敗を返す（ACは✅化済みのため、再実行すれば冪等に再試行できる）

失敗条件（**fail-closed**）:

- 存在しないAC番号を指定した → `INVALID_INPUT`（本文を一切書き換えない）
- `acceptanceCriteria` が空配列 → `INVALID_INPUT`（「全AC」に拡大解釈しない）
- `acceptanceCriteria` を省略したが、本文にAC行が1件も無い → `INVALID_INPUT`
  （書式不一致による無言スキップを防ぐ）
- 既に✅のACは冪等（GitHubへの書込を行わず `skipped: true`）

### AC行の書式

`acCount`（WP検索の出力）と✅化は**同じ判定**を使う。以下の書式を受理する。

| 要素       | 受理する形式                                                     |
| ---------- | ---------------------------------------------------------------- |
| ビュレット | `-` または `*`                                                   |
| チェック   | `[ ]`（未完了）/ `[x]` / `[X]`（完了）                           |
| 番号       | `AC1:`（半角/全角コロン`：`、全角数字`ＡＣ１`も可）              |
| 番号省略   | `AC: 内容`（`management.md` §5.1 の形式）。出現順に1始まりで採番 |
| 行末       | LF / CRLF のどちらでもよい（改行コードは保持）                   |

- **コードフェンス（``` / ~~~）内の行は対象外**（本文中の書式例を書き換えないため）
- 同一番号の行が複数ある場合は**先頭行のみ**✅化し、その番号を `output.duplicates` に報告する

### 出力

本スクリプトは `ExecutionResult` をJSONで出力する。stepResultsから以下の情報を確認できる。

- `output.statusChanged`: Project Status を実際に変更したか
- `output.acceptanceCriteria.updated`: ✅化したAC番号
- `output.acceptanceCriteria.alreadyDone`: 既に✅だったAC番号
- `output.acceptanceCriteria.duplicates`: 本文に重複していたAC番号
- `output.acceptanceCriteria.total`: 本文中のAC行数
- `output.acceptanceCriteria.skipped`: 書込を省略したか（既に✅だった場合 true）

### 実行例

```bash
# id に node-id、code に Issue番号を指定（AC1 と AC3 のみ✅化）
echo '{"identifier":{"title":"Session-Lifecycle-Persistence","id":"I_kwDOR5-zI88AAAABKcLX9A","code":"612"},"acceptanceCriteria":[1,3]}' \
  | deno run -A .opencode/skills/bundles/management-bundle/complete-work-package/scripts/complete_wp.ts

# AC指定を省略 → 本文中の全ACを✅化
echo '{"identifier":{"title":"Session-Lifecycle-Persistence","id":"I_kwDOR5-zI88AAAABKcLX9A","code":"612"}}' \
  | deno run -A .opencode/skills/bundles/management-bundle/complete-work-package/scripts/complete_wp.ts
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
echo '{"identifier":{"title":"EntityLifecycle","id":"I_kwDOR5-zI88AAAABMOdNyg","code":"655"}}' | deno run -A .opencode/skills/bundles/management-bundle/complete-work-package/scripts/complete_pbi.ts
```

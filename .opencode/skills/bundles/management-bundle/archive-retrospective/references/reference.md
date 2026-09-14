# archive-retrospective リファレンス

## 業務概要

スプリント終了時に、対象スプリントの振り返りを終了（アーカイブ）する。KPT とスプリント評価の
記録完了を前提とする。両方の記録が未設定の振り返りは終了できない（検証でエラーになる）。

## archive_retrospective.ts — 振り返りの終了

### 入力パラメータ

| パラメータ     | 型       | 必須 | 説明                                                          |
| -------------- | -------- | ---- | ------------------------------------------------------------- |
| `sprintNumber` | `number` | △    | 対象スプリント番号。`code` 未指定時に検索で特定するために使用 |
| `code`         | `string` | △    | 対象の振り返り番号。`sprintNumber` の代わりに直接指定         |
| `title`        | `string` | 任意 | 対象の振り返りタイトル。`code` 指定時に省略可（自動補完）     |
| `scope`        | `object` | 任意 | 対象リポジトリのスコープ。省略時は実行時解決                  |

> `code` と `sprintNumber` の少なくとも一方が必須。`code` 優先。空の `code` は拒否される。

### 対象の特定

1. **`code` 指定**: 指定された振り返り番号をそのまま対象とする（検索不要）。
2. **`sprintNumber` 指定**: 振り返りを検索し、タイトルが「Sprint N Retrospective」形式（N =
   スプリント番号）に**完全一致**するものを特定する。前方一致（"Sprint 2" が "Sprint 20"
   に誤マッチ） はしない。0件・複数件の場合はエラー。

### dry-run 出力の解釈

`resolvedTarget` が解決された対象を、`steps` に含まれる終了ステップの `params` が Close 操作を
示す。`code` 未指定の dry-run では `resolvedTarget` に `{"note":"実行時に検索します"}` が入る
（dry-run は検索を実行しない）。

```json
{
  "summary": "Archive retrospective: Sprint 20 Retrospective",
  "resolvedTarget": { "code": "670", "title": "Sprint 20 Retrospective" },
  "steps": [
    { "entity": "Scope", "operation": "resolve" },
    {
      "entity": "Retrospective",
      "operation": "archive",
      "params": { "itemId": "670", "state": "closed" }
    }
  ]
}
```

チャットウィンドウでは、`summary` を見出しとして先頭に表示し、`steps` を以下の形式で展開する：

```
📋 Plan: <summary>
  • 対象: <title> (#<code>)
  • 操作: 振り返りを終了
```

### 実行例

```bash
# dry-run（終了対象の確認のみ・何も変更しない）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/archive-retrospective/scripts/archive_retrospective.ts --dry-run

# 実実行（振り返りを終了）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/archive-retrospective/scripts/archive_retrospective.ts
```

## アーキテクチャ上の責務

- スクリプトは「入力の検証・対象の特定・UseCase呼び出し・結果表示」を担当する
- KPT・評価の記録完了確認は SKILL.md の手順・AI側に保持する（Step 1）
- 外部操作は既存 UseCase のみを経由する

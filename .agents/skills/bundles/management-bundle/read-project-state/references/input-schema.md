# read-project-state 入力スキーマ

本ファイルは
`.agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts`
への入力JSONスキーマと、各Entityの対応操作一覧を定義する。

## 入力形式

```bash
deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
```

標準入力に以下のJSONを渡す。

```json
{
  "entityType": "<EntityType>",
  "operation": "<search | find>",
  "params": { "<キー>": "<値>", ... }
}
```

| キー       | 型         | 必須 | 説明                                            |
| ---------- | ---------- | ---- | ----------------------------------------------- |
| entityType | string     | 必須 | 下記「EntityType 一覧」のいずれか               |
| operation  | `"search"` | 必須 | 一覧検索（条件を指定して複数の候補を得る）      |
|            | `"find"`   | 必須 | 詳細閲覧（Issue番号等で単一エンティティを得る） |
| params     | object     | 必須 | 操作に応じた条件（下記「params キー一覧」）     |

## EntityType 一覧と対応操作

| EntityType         | search | find | 備考                                                                                         |
| ------------------ | ------ | ---- | -------------------------------------------------------------------------------------------- |
| Vision             | 対象外 | あり | 単一インスタンス。search は不可                                                              |
| ProductGoal        | 対象外 | あり | 単一インスタンス。search は不可                                                              |
| Sprint             | あり   | あり | search は state 指定（open / closed / all）で一覧を取得。code 省略 find は最新オープンを表示 |
| Epic               | あり   | あり |                                                                                              |
| Feature            | あり   | あり |                                                                                              |
| ProductBacklogItem | あり   | あり |                                                                                              |
| WorkPackage        | あり   | あり |                                                                                              |
| Review             | あり   | あり |                                                                                              |
| Retrospective      | あり   | あり | 未実装。実行時に `not yet implemented in gateway layer` エラーを返す                         |
| Scope              | なし   | なし | 検索・閲覧ともに不可（INVALID_INPUT）                                                        |

- **search 対象外 Entity**（Vision / ProductGoal）を search で呼んだ場合:
  `search is not supported for <Entity>: single-instance by business rule. Use find instead.`
  を返す。
- **Sprint search** の `state` は `open` / `closed` / `all` のみ指定可能。
  次スプリント番号の把握には `state: "closed"` で最新完了スプリントを確認する。
- **Retrospective** を search / find で呼んだ場合:
  `Retrospective: not yet implemented in gateway layer` を返す。

## params キー一覧

| キー         | 対象操作 | 型     | 説明                                                                           |
| ------------ | -------- | ------ | ------------------------------------------------------------------------------ |
| itemId       | find     | string | Issue番号。**find の主キー**。`"42"` のように指定                              |
| code         | find     | string | itemId の別名。どちらかを指定すればよい                                        |
| id           | find     | string | 任意。node ID等。省略可能                                                      |
| number       | find     | string | Sprint 専用。スプリント番号（itemId/code の別名）                              |
| status       | search   | string | ステータス（Todo / In Progress / Done 等）                                     |
| state        | search   | string | Issue の状態（open / closed）。**Sprint search 専用の値**: open / closed / all |
| sprintNumber | search   | string | スプリント番号で絞り込み                                                       |
| keyword      | search   | string | タイトル等のキーワード検索                                                     |

## 実行例

### find（PBI #42 を調べる）

```json
{
  "entityType": "ProductBacklogItem",
  "operation": "find",
  "params": { "itemId": "42" }
}
```

### search（Todo の PBI を探す）

```json
{
  "entityType": "ProductBacklogItem",
  "operation": "search",
  "params": { "status": "Todo" }
}
```

### find（最新の Sprint を調べる）

```json
{
  "entityType": "Sprint",
  "operation": "find",
  "params": {}
}
```

### search（完了済みスプリントの一覧を探す）

```json
{
  "entityType": "Sprint",
  "operation": "search",
  "params": { "state": "closed" }
}
```
